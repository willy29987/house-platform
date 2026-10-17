export type UploadMediaKind = "image" | "video" | "pdf";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "bmp", "tif", "tiff"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv"]);
const PDF_EXT = new Set(["pdf"]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  pdf: "application/pdf",
};

function fileExtension(name: string) {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

function kindFromMime(mime: string): UploadMediaKind | null {
  const type = mime.toLowerCase().trim();
  if (!type) return null;
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf") return "pdf";
  return null;
}

function kindFromExtension(ext: string): UploadMediaKind | null {
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (PDF_EXT.has(ext)) return "pdf";
  return null;
}

/** 依 MIME 與副檔名判斷檔案類型（手機常送 application/octet-stream 或空 type）。 */
export function classifyUploadFile(file: { name: string; type: string }): UploadMediaKind | null {
  const fromMime = kindFromMime(file.type);
  if (fromMime) return fromMime;

  const ext = fileExtension(file.name);
  if (!ext) return null;
  return kindFromExtension(ext);
}

export function resolveUploadContentType(file: { name: string; type: string }, kind: UploadMediaKind) {
  const mime = file.type?.trim().toLowerCase();
  if (mime && mime !== "application/octet-stream") return mime;

  const ext = fileExtension(file.name);
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];

  if (kind === "image") return "image/jpeg";
  if (kind === "video") return "video/mp4";
  return "application/pdf";
}

export function defaultUploadExtension(kind: UploadMediaKind) {
  if (kind === "image") return "jpg";
  if (kind === "video") return "mp4";
  return "pdf";
}
