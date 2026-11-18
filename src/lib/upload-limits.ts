/** 上傳容量上限（直傳雲端後可真正用到這些數字） */

export const MAX_UPLOAD_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_PDF_BYTES = 20 * 1024 * 1024;

export function formatUploadMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}
