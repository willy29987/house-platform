import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { isSupabaseStorageConfigured } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const env = process.env.NODE_ENV;
  const onVercel = Boolean(process.env.VERCEL);
  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasSessionToken = Boolean(process.env.ADMIN_SESSION_TOKEN);
  const hasLineUrl = Boolean(process.env.NEXT_PUBLIC_LINE_OA_URL);
  const hasStorage = isSupabaseStorageConfigured();

  let dbCount = -1;
  let dbError: string | null = null;
  if (hasDb) {
    try {
      dbCount = await prisma.listing.count();
    } catch (e) {
      dbError = e instanceof Error ? e.message : "db error";
    }
  }

  const checks = [
    { key: "DATABASE_URL", ok: hasDb, hint: "沒填 → Prisma 無法連線 Supabase" },
    { key: "Prisma 可查詢", ok: dbError === null && dbCount >= 0, hint: dbError ?? `目前 ${dbCount} 筆物件` },
    { key: "ADMIN_SESSION_TOKEN", ok: hasSessionToken, hint: "沒填 → 沒人能登入後台" },
    {
      key: "Supabase Storage",
      ok: hasStorage,
      hint: hasStorage
        ? "圖片/影片/PDF 會上傳到雲端"
        : onVercel
          ? "⚠️ 正式環境未設定，上傳會被擋下"
          : "本機開發可暫不設定（會存到 public/uploads/）",
    },
    { key: "NEXT_PUBLIC_LINE_OA_URL", ok: hasLineUrl, hint: "沒填 → 前台不顯示 LINE 浮動按鈕（不影響功能）" },
  ];

  const ready = checks.every((c) => c.ok || c.key === "NEXT_PUBLIC_LINE_OA_URL" || (c.key === "Supabase Storage" && !onVercel));

  return NextResponse.json({
    ok: ready,
    env,
    onVercel,
    checks,
  });
}
