import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { enhanceListingPhoto, type ListingPhotoEnhanceTier } from "@/lib/listing-photo-enhance";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "@/lib/storage";
import {
  classifyUploadFile,
  defaultUploadExtension,
  resolveUploadContentType,
} from "@/lib/upload-media";

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const purpose = String(formData.get("purpose") ?? "").trim().toLowerCase();
  const enhanceListingPhotos = purpose === "listing";

  if (!files || files.length === 0) {
    return NextResponse.json({ ok: false, message: "未收到檔案" }, { status: 400 });
  }

  const useSupabase = isSupabaseStorageConfigured();
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  if (!useSupabase && isProduction) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "正式環境尚未設定 Supabase Storage，為避免檔案遺失上傳已被擋下。請設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_STORAGE_BUCKET 後再試。",
      },
      { status: 500 },
    );
  }

  const urls: string[] = [];
  const enhance: Array<{ tier: ListingPhotoEnhanceTier; reason: string }> = [];

  for (const file of files) {
    const kind = classifyUploadFile(file);
    if (!kind) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "只允許上傳圖片、影片或 PDF（支援 JPG/PNG/WEBP/HEIC、MP4/MOV/WEBM 等）。若從手機選檔失敗，請改選「照片」或確認副檔名正確。",
        },
        { status: 400 },
      );
    }

    if (kind === "video" && file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, message: "影片檔案不得大於 100MB" },
        { status: 400 },
      );
    }
    if (kind === "pdf" && file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, message: "PDF 檔案不得大於 20MB" },
        { status: 400 },
      );
    }

    let ext = file.name.split(".").pop()?.toLowerCase() || defaultUploadExtension(kind);
    let buffer = Buffer.from(await file.arrayBuffer());
    let contentType = resolveUploadContentType(file, kind);

    if (enhanceListingPhotos && kind === "image") {
      const enhanced = await enhanceListingPhoto(buffer);
      buffer = Buffer.from(enhanced.buffer);
      contentType = enhanced.contentType;
      ext = enhanced.extension;
      enhance.push({ tier: enhanced.tier, reason: enhanced.reason });
    }

    const subdir = kind === "image" ? "images" : kind === "video" ? "videos" : "docs";
    const filename = `${subdir}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    if (useSupabase) {
      try {
        const publicUrl = await uploadToSupabaseStorage(filename, buffer, contentType);
        urls.push(publicUrl);
      } catch (e) {
        const message = e instanceof Error ? e.message : "上傳失敗";
        return NextResponse.json({ ok: false, message }, { status: 500 });
      }
    } else {
      const uploadDir = path.join(process.cwd(), "public", "uploads", subdir);
      await mkdir(uploadDir, { recursive: true });
      const baseName = filename.split("/").pop()!;
      await writeFile(path.join(uploadDir, baseName), buffer);
      urls.push(`/uploads/${subdir}/${baseName}`);
    }
  }

  return NextResponse.json({
    ok: true,
    urls,
    ...(enhance.length ? { enhance } : {}),
  });
}
