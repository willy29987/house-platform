/** 後台媒體：瀏覽器壓縮 → 直傳 Supabase（平行）→ 美化可背景跑 */

import { compressImagesForUpload } from "@/lib/client-image-compress";
import {
  formatUploadMb,
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_UPLOAD_VIDEO_BYTES,
} from "@/lib/upload-limits";
import { classifyUploadFile } from "@/lib/upload-media";

export type AdminDirectUploadResult = {
  urls: string[];
  enhance?: Array<{ tier: string; reason: string }>;
};

export type AdminUploadProgress = {
  phase: "compress" | "upload" | "enhance" | "done";
  done: number;
  total: number;
};

export type AdminUploadOptions = {
  purpose?: "listing";
  /** wait=等美化完才 resolve；background=上傳完即可，美化完成後 onUrlReplaced */
  enhanceMode?: "wait" | "background" | "off";
  onProgress?: (p: AdminUploadProgress) => void;
  /** 單張上傳成功（美化前）即可先顯示 */
  onUrlReady?: (url: string, index: number) => void;
  /** 美化覆寫後替換網址 */
  onUrlReplaced?: (fromUrl: string, toUrl: string, index: number) => void;
};

type SignResponse =
  | { ok: true; mode: "server" }
  | {
      ok: true;
      mode: "direct";
      purpose?: string;
      uploads: Array<{
        name: string;
        path: string;
        token: string;
        signedUrl: string;
        publicUrl: string;
        contentType: string;
        kind: "image" | "video" | "pdf";
      }>;
    }
  | { ok: false; message?: string };

const UPLOAD_CONCURRENCY = 6;
const ENHANCE_CONCURRENCY = 3;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => worker()));
  return results;
}

async function uploadViaServer(
  files: File[],
  purpose?: string,
  onProgress?: (p: AdminUploadProgress) => void,
): Promise<AdminDirectUploadResult> {
  const urls: string[] = new Array(files.length);
  const enhance: Array<{ tier: string; reason: string } | undefined> = new Array(files.length);
  let done = 0;

  await mapPool(files, UPLOAD_CONCURRENCY, async (file, index) => {
    const fd = new FormData();
    fd.append("files", file);
    if (purpose === "listing") fd.append("purpose", "listing");
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    const contentType = res.headers.get("content-type") ?? "";
    const result = contentType.includes("application/json")
      ? ((await res.json()) as {
          ok: boolean;
          urls?: string[];
          message?: string;
          enhance?: Array<{ tier: string; reason: string }>;
        })
      : { ok: false, message: await res.text() };

    if (!res.ok || !result.ok || !result.urls?.length) {
      if (res.status === 413) {
        throw new Error("檔案太大（平台請求上限約 4.5MB）。請改用已設定雲端直傳的正式站，或單檔壓小。");
      }
      throw new Error(result.message || "上傳失敗");
    }
    urls[index] = result.urls[0]!;
    if (result.enhance?.[0]) enhance[index] = result.enhance[0];
    done++;
    onProgress?.({ phase: "upload", done, total: files.length });
  });

  const enhanceList = enhance.filter(Boolean) as Array<{ tier: string; reason: string }>;
  return { urls, ...(enhanceList.length ? { enhance: enhanceList } : {}) };
}

async function putToSignedUrl(signedUrl: string, file: File, contentType: string) {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType || file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `直傳失敗（HTTP ${res.status}）`);
  }
}

async function enhanceListingUrl(publicUrl: string, path: string): Promise<{
  url: string;
  enhance?: { tier: string; reason: string };
}> {
  const enhRes = await fetch("/api/admin/upload/enhance-listing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ publicUrl, path }),
  });
  const enhJson = (await enhRes.json()) as {
    ok?: boolean;
    url?: string;
    enhance?: { tier: string; reason: string };
    message?: string;
  };
  if (enhRes.ok && enhJson.ok && enhJson.url) {
    return { url: enhJson.url, enhance: enhJson.enhance };
  }
  return {
    url: publicUrl,
    enhance: { tier: "skip", reason: enhJson.message || "美化略過，已用原圖" },
  };
}

/**
 * 後台上傳圖片／影片：壓縮 → 有 Supabase 就平行直傳；listing 美化可背景。
 */
export async function uploadAdminMediaFiles(
  files: File[],
  opts?: AdminUploadOptions,
): Promise<AdminDirectUploadResult> {
  if (!files.length) return { urls: [] };

  const enhanceMode = opts?.enhanceMode ?? (opts?.purpose === "listing" ? "background" : "off");
  const onProgress = opts?.onProgress;

  for (const file of files) {
    const kind = classifyUploadFile(file);
    if (kind === "image" && file.size > MAX_UPLOAD_IMAGE_BYTES) {
      throw new Error(`「${file.name}」超過圖片上限 ${formatUploadMb(MAX_UPLOAD_IMAGE_BYTES)}`);
    }
    if (kind === "video" && file.size > MAX_UPLOAD_VIDEO_BYTES) {
      throw new Error(`「${file.name}」超過影片上限 ${formatUploadMb(MAX_UPLOAD_VIDEO_BYTES)}`);
    }
  }

  onProgress?.({ phase: "compress", done: 0, total: files.length });
  const prepared = await compressImagesForUpload(files, (done, total) => {
    onProgress?.({ phase: "compress", done, total });
  });

  const signRes = await fetch("/api/admin/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      purpose: opts?.purpose,
      files: prepared.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    }),
  });
  const signJson = (await signRes.json()) as SignResponse;
  if (!signRes.ok || !signJson.ok) {
    throw new Error(("message" in signJson && signJson.message) || "無法建立上傳憑證");
  }

  if (signJson.mode === "server") {
    // 伺服器路徑仍會在後端美化；已先壓縮可明顯加速
    const result = await uploadViaServer(prepared, opts?.purpose, onProgress);
    for (let i = 0; i < result.urls.length; i++) {
      opts?.onUrlReady?.(result.urls[i]!, i);
    }
    onProgress?.({ phase: "done", done: result.urls.length, total: result.urls.length });
    return result;
  }

  const urls: string[] = new Array(prepared.length);
  const enhanceMeta: Array<{ tier: string; reason: string } | undefined> = new Array(prepared.length);
  let uploaded = 0;

  onProgress?.({ phase: "upload", done: 0, total: prepared.length });

  await mapPool(prepared, UPLOAD_CONCURRENCY, async (file, i) => {
    const slot = signJson.uploads[i];
    if (!slot) throw new Error("上傳憑證數量不符");

    await putToSignedUrl(slot.signedUrl, file, slot.contentType);
    urls[i] = slot.publicUrl;
    opts?.onUrlReady?.(slot.publicUrl, i);
    uploaded++;
    onProgress?.({ phase: "upload", done: uploaded, total: prepared.length });
  });

  const shouldEnhance =
    opts?.purpose === "listing" &&
    enhanceMode !== "off" &&
    signJson.uploads.some((u) => u.kind === "image");

  const runEnhance = async () => {
    const imageIndexes = prepared
      .map((_, i) => i)
      .filter((i) => signJson.uploads[i]?.kind === "image");

    if (!imageIndexes.length) return;

    let enhancedDone = 0;
    onProgress?.({ phase: "enhance", done: 0, total: imageIndexes.length });

    await mapPool(imageIndexes, ENHANCE_CONCURRENCY, async (i) => {
      const slot = signJson.uploads[i]!;
      const fromUrl = urls[i]!;
      try {
        const { url, enhance } = await enhanceListingUrl(slot.publicUrl, slot.path);
        if (enhance) enhanceMeta[i] = enhance;
        if (url !== fromUrl) {
          urls[i] = url;
          opts?.onUrlReplaced?.(fromUrl, url, i);
        }
      } catch {
        enhanceMeta[i] = { tier: "skip", reason: "美化略過，已用原圖" };
      }
      enhancedDone++;
      onProgress?.({ phase: "enhance", done: enhancedDone, total: imageIndexes.length });
    });
  };

  if (shouldEnhance && enhanceMode === "wait") {
    await runEnhance();
  } else if (shouldEnhance && enhanceMode === "background") {
    // 不擋回傳；美化完成後透過 onUrlReplaced 更新
    void runEnhance().catch(() => {});
  }

  const enhance = enhanceMeta.filter(Boolean) as Array<{ tier: string; reason: string }>;
  onProgress?.({ phase: "done", done: urls.length, total: urls.length });
  return { urls, ...(enhance.length ? { enhance } : {}) };
}
