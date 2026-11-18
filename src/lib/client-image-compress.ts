/**
 * 瀏覽器端壓縮圖片，減少上傳體積與時間。
 * HEIC／解碼失敗時退回原檔。
 */

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
/** 已夠小的 JPEG／WebP 不再重壓（省時間） */
const SKIP_UNDER_BYTES = 450 * 1024;

function isProbablyImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(file.name);
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法解碼圖片"));
    };
    img.src = url;
  });
}

async function drawToJpegBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("壓縮失敗");
  return blob;
}

function scaledSize(w: number, h: number): { width: number; height: number } {
  const edge = Math.max(w, h);
  if (edge <= MAX_EDGE) return { width: w, height: h };
  const scale = MAX_EDGE / edge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * 單張壓縮成 JPEG；失敗或非圖片則回傳原 File。
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!isProbablyImage(file)) return file;
  if (file.type === "image/gif") return file; // 保留動圖

  const type = (file.type || "").toLowerCase();
  if (
    file.size <= SKIP_UNDER_BYTES &&
    (type === "image/jpeg" || type === "image/jpg" || type === "image/webp")
  ) {
    return file;
  }

  try {
    let width = 0;
    let height = 0;
    let source: CanvasImageSource;

    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        source = bitmap;
      } catch {
        const img = await loadImageElement(file);
        width = img.naturalWidth;
        height = img.naturalHeight;
        source = img;
      }
    } else {
      const img = await loadImageElement(file);
      width = img.naturalWidth;
      height = img.naturalHeight;
      source = img;
    }

    if (!width || !height) return file;

    const { width: tw, height: th } = scaledSize(width, height);
    // 尺寸沒變且原本就很小 → 不重壓
    if (tw === width && th === height && file.size <= SKIP_UNDER_BYTES) {
      if ("close" in source && typeof (source as ImageBitmap).close === "function") {
        (source as ImageBitmap).close();
      }
      return file;
    }

    const blob = await drawToJpegBlob(source, tw, th);
    if ("close" in source && typeof (source as ImageBitmap).close === "function") {
      (source as ImageBitmap).close();
    }

    // 壓完反而更大就用原檔
    if (blob.size >= file.size * 0.98) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function compressImagesForUpload(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<File[]> {
  const out: File[] = new Array(files.length);
  let done = 0;
  const CONCURRENCY = 4;
  let next = 0;

  async function worker() {
    while (next < files.length) {
      const i = next++;
      out[i] = await compressImageForUpload(files[i]!);
      done++;
      onProgress?.(done, files.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()),
  );
  return out;
}
