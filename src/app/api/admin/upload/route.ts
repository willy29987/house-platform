import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { isSupabaseStorageConfigured, uploadToSupabaseStorage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

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

  for (const file of files) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isVideo && !isPdf) {
      return NextResponse.json(
        { ok: false, message: "只允許上傳圖片、影片或 PDF 檔案" },
        { status: 400 },
      );
    }

    if (isVideo && file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, message: "影片檔案不得大於 100MB" },
        { status: 400 },
      );
    }
    if (isPdf && file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, message: "PDF 檔案不得大於 20MB" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() ?? (isImage ? "jpg" : isPdf ? "pdf" : "mp4");
    const subdir = isImage ? "images" : isVideo ? "videos" : "docs";
    const filename = `${subdir}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (useSupabase) {
      try {
        const publicUrl = await uploadToSupabaseStorage(filename, buffer, file.type);
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

  return NextResponse.json({ ok: true, urls });
}
