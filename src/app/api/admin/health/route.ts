import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { probeSupabaseStorage, validateSupabaseStorageConfig } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const env = process.env.NODE_ENV;
  const onVercel = Boolean(process.env.VERCEL);
  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasSessionToken = Boolean(process.env.ADMIN_SESSION_TOKEN);
  const hasLineUrl = Boolean(process.env.NEXT_PUBLIC_LINE_OA_URL);
  const storageConfig = validateSupabaseStorageConfig();
  const hasStorage = storageConfig.ok;
  let storageProbe: { ok: boolean; message: string } | null = null;
  if (hasStorage) {
    storageProbe = await probeSupabaseStorage();
  }

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
      key: "Supabase Storage 變數",
      ok: hasStorage,
      hint: hasStorage
        ? `URL：${storageConfig.ok ? storageConfig.url : "—"} / bucket：${storageConfig.ok ? storageConfig.bucket : "—"}`
        : storageConfig.ok
          ? "—"
          : storageConfig.message,
    },
    {
      key: "Supabase Storage 連線",
      ok: Boolean(storageProbe?.ok),
      hint: storageProbe?.message
        ?? (onVercel ? "⚠️ 正式環境未設定，上傳會被擋下" : "本機可暫不設定（會存到 public/uploads/）"),
    },
    { key: "NEXT_PUBLIC_LINE_OA_URL", ok: hasLineUrl, hint: "沒填 → 前台不顯示 LINE 浮動按鈕（不影響功能）" },
  ];

  const ready = checks.every(
    (c) =>
      c.ok ||
      c.key === "NEXT_PUBLIC_LINE_OA_URL" ||
      (c.key.startsWith("Supabase Storage") && !onVercel),
  );

  return NextResponse.json({
    ok: ready,
    env,
    onVercel,
    checks,
  });
}
