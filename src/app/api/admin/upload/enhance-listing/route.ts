import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { enhanceListingPhoto } from "@/lib/listing-photo-enhance";
import { isSupabaseStorageConfigured, upsertSupabaseStorageObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 直傳完成後：後端拉原圖美化並覆寫同一物件路徑（不經瀏覽器再傳整檔）。
 */
export async function POST(request: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ ok: false, message: "未設定雲端儲存" }, { status: 500 });
  }

  let body: { publicUrl?: string; path?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "無效的 JSON" }, { status: 400 });
  }

  const publicUrl = typeof body.publicUrl === "string" ? body.publicUrl.trim() : "";
  const objectPath = typeof body.path === "string" ? body.path.trim().replace(/^\/+/, "") : "";
  if (!publicUrl || !objectPath) {
    return NextResponse.json({ ok: false, message: "缺少 publicUrl 或 path" }, { status: 400 });
  }

  try {
    const res = await fetch(publicUrl, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: "無法讀取已上傳圖片" }, { status: 400 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const enhanced = await enhanceListingPhoto(buffer);
    const nextUrl = await upsertSupabaseStorageObject(
      objectPath,
      Buffer.from(enhanced.buffer),
      enhanced.contentType,
    );
    // cache-bust so UI picks up replaced object
    const bust = `${nextUrl}${nextUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
    return NextResponse.json({
      ok: true,
      url: bust,
      enhance: { tier: enhanced.tier, reason: enhanced.reason },
    });
  } catch (error) {
    console.error("[admin/upload/enhance-listing]", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "美化失敗",
        url: publicUrl,
      },
      { status: 500 },
    );
  }
}
