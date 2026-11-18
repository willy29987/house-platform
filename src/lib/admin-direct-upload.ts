/** 後台媒體：優先直傳 Supabase，避開 Vercel 4.5MB */

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

async function uploadViaServer(files: File[], purpose?: string): Promise<AdminDirectUploadResult> {
  const urls: string[] = [];
  const enhance: Array<{ tier: string; reason: string }> = [];

  // 本機／備援：一檔一請求，降低撞上限機率
  for (const file of files) {
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
    urls.push(...result.urls);
    if (result.enhance?.length) enhance.push(...result.enhance);
  }

  return { urls, ...(enhance.length ? { enhance } : {}) };
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

/**
 * 後台上傳圖片／影片：有 Supabase 就直傳；否則逐檔走伺服器。
 */
export async function uploadAdminMediaFiles(
  files: File[],
  opts?: { purpose?: "listing" },
): Promise<AdminDirectUploadResult> {
  if (!files.length) return { urls: [] };

  for (const file of files) {
    const kind = classifyUploadFile(file);
    if (kind === "image" && file.size > MAX_UPLOAD_IMAGE_BYTES) {
      throw new Error(`「${file.name}」超過圖片上限 ${formatUploadMb(MAX_UPLOAD_IMAGE_BYTES)}`);
    }
    if (kind === "video" && file.size > MAX_UPLOAD_VIDEO_BYTES) {
      throw new Error(`「${file.name}」超過影片上限 ${formatUploadMb(MAX_UPLOAD_VIDEO_BYTES)}`);
    }
  }

  const signRes = await fetch("/api/admin/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      purpose: opts?.purpose,
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    }),
  });
  const signJson = (await signRes.json()) as SignResponse;
  if (!signRes.ok || !signJson.ok) {
    throw new Error(("message" in signJson && signJson.message) || "無法建立上傳憑證");
  }

  if (signJson.mode === "server") {
    return uploadViaServer(files, opts?.purpose);
  }

  const urls: string[] = [];
  const enhance: Array<{ tier: string; reason: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const slot = signJson.uploads[i];
    if (!slot) throw new Error("上傳憑證數量不符");

    await putToSignedUrl(slot.signedUrl, file, slot.contentType);

    let finalUrl = slot.publicUrl;
    if (opts?.purpose === "listing" && slot.kind === "image") {
      try {
        const enhRes = await fetch("/api/admin/upload/enhance-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ publicUrl: slot.publicUrl, path: slot.path }),
        });
        const enhJson = (await enhRes.json()) as {
          ok?: boolean;
          url?: string;
          enhance?: { tier: string; reason: string };
          message?: string;
        };
        if (enhRes.ok && enhJson.ok && enhJson.url) {
          finalUrl = enhJson.url;
          if (enhJson.enhance) enhance.push(enhJson.enhance);
        } else {
          enhance.push({ tier: "skip", reason: enhJson.message || "美化略過，已用原圖" });
        }
      } catch {
        enhance.push({ tier: "skip", reason: "美化略過，已用原圖" });
      }
    }

    urls.push(finalUrl);
  }

  return { urls, ...(enhance.length ? { enhance } : {}) };
}
