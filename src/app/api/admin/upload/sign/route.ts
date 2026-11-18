import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { createSupabaseSignedUpload, isSupabaseStorageConfigured } from "@/lib/storage";
import { classifyUploadFile, defaultUploadExtension, resolveUploadContentType } from "@/lib/upload-media";
import {
  formatUploadMb,
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_UPLOAD_PDF_BYTES,
  MAX_UPLOAD_VIDEO_BYTES,
} from "@/lib/upload-limits";

export const runtime = "nodejs";

type SignFileMeta = {
  name?: string;
  type?: string;
  size?: number;
};

/**
 * 只簽憑證、不收檔案本體 → 避開 Vercel ~4.5MB body。
 * 未設定 Supabase 時回 mode=server，前端改走舊的 /api/admin/upload（本機）。
 */
export async function POST(request: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  let body: { files?: SignFileMeta[]; purpose?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "無效的 JSON" }, { status: 400 });
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) {
    return NextResponse.json({ ok: false, message: "未收到檔案資訊" }, { status: 400 });
  }
  if (files.length > 30) {
    return NextResponse.json({ ok: false, message: "一次最多簽署 30 個檔案，請分批" }, { status: 400 });
  }

  if (!isSupabaseStorageConfigured()) {
    const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
    if (isProduction) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "正式環境尚未設定 Supabase Storage。請設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_STORAGE_BUCKET。",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, mode: "server" as const });
  }

  const slots: Array<{
    name: string;
    path: string;
    token: string;
    signedUrl: string;
    publicUrl: string;
    contentType: string;
    kind: "image" | "video" | "pdf";
  }> = [];

  for (const meta of files) {
    const name = typeof meta.name === "string" ? meta.name : "file";
    const type = typeof meta.type === "string" ? meta.type : "";
    const size = typeof meta.size === "number" ? meta.size : 0;
    const fake = { name, type };
    const kind = classifyUploadFile(fake);
    if (!kind) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "只允許上傳圖片、影片或 PDF（支援 JPG/PNG/WEBP/HEIC、MP4/MOV/WEBM 等）。",
        },
        { status: 400 },
      );
    }
    if (kind === "image" && size > MAX_UPLOAD_IMAGE_BYTES) {
      return NextResponse.json(
        { ok: false, message: `「${name}」超過圖片上限 ${formatUploadMb(MAX_UPLOAD_IMAGE_BYTES)}` },
        { status: 400 },
      );
    }
    if (kind === "video" && size > MAX_UPLOAD_VIDEO_BYTES) {
      return NextResponse.json(
        { ok: false, message: `「${name}」超過影片上限 ${formatUploadMb(MAX_UPLOAD_VIDEO_BYTES)}` },
        { status: 400 },
      );
    }
    if (kind === "pdf" && size > MAX_UPLOAD_PDF_BYTES) {
      return NextResponse.json(
        { ok: false, message: `「${name}」超過 PDF 上限 ${formatUploadMb(MAX_UPLOAD_PDF_BYTES)}` },
        { status: 400 },
      );
    }

    const ext = name.split(".").pop()?.toLowerCase() || defaultUploadExtension(kind);
    const contentType = resolveUploadContentType(fake, kind);
    const subdir = kind === "image" ? "images" : kind === "video" ? "videos" : "docs";
    const filename = `${subdir}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const signed = await createSupabaseSignedUpload({ filename, contentType });
    slots.push({
      name,
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      publicUrl: signed.publicUrl,
      contentType,
      kind,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "direct" as const,
    purpose: String(body.purpose ?? "").trim().toLowerCase(),
    uploads: slots,
  });
}
