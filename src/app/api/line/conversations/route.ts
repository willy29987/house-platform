import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { readLineConversations } from "@/lib/line-conversations";
import { listOpenGuestSessions } from "@/lib/line-guest-sessions";
import { listGuestProfileUserIds } from "@/lib/line-guest-profile";
import { listActiveGuestWatches } from "@/lib/line-guest-watch";
import { buildPublicBaseUrl, pushLineMessages, type LineMessage } from "@/lib/line-messaging";
import { syncRecentGuestBookings } from "@/lib/line-booking-sync";
import { readLineRentalCases } from "@/lib/line-rental-cases";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

function toAbsoluteHttpsUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (/^http:\/\//i.test(value)) return null;
  if (!value.startsWith("/")) return null;
  const base = buildPublicBaseUrl();
  if (!base || !/^https:\/\//i.test(base)) return null;
  return `${base}${value}`;
}

export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  await syncRecentGuestBookings().catch((error) => {
    console.warn("[line/conversations] sync bookings failed", error);
  });

  const [conversations, cases, sessions, watches, profileUserIds] = await Promise.all([
    readLineConversations(),
    readLineRentalCases(),
    listOpenGuestSessions(),
    listActiveGuestWatches(),
    listGuestProfileUserIds(),
  ]);

  return NextResponse.json(
    { conversations, cases, sessions, watches, profileUserIds, fetchedAt: new Date().toISOString() },
    { headers: NO_STORE },
  );
}

/** 客服從網頁回覆 → 推到 LINE，並寫入同一份對話紀錄 */
export async function POST(request: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  let body: {
    lineUserId?: string;
    text?: string;
    sticker?: { packageId?: string; stickerId?: string };
    imageUrl?: string;
    videoUrl?: string;
    previewImageUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const lineUserId = body.lineUserId?.trim() ?? "";
  if (!lineUserId) {
    return NextResponse.json({ error: "缺少 lineUserId" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const packageId = body.sticker?.packageId?.trim() ?? "";
  const stickerId = body.sticker?.stickerId?.trim() ?? "";
  const imageUrl = body.imageUrl?.trim() ?? "";
  const videoUrl = body.videoUrl?.trim() ?? "";
  const previewImageUrl = body.previewImageUrl?.trim() ?? "";

  let message: LineMessage | null = null;
  if (packageId && stickerId && /^\d+$/.test(packageId) && /^\d+$/.test(stickerId)) {
    message = { type: "sticker", packageId, stickerId };
  } else if (videoUrl) {
    const absolute = toAbsoluteHttpsUrl(videoUrl);
    const preview = toAbsoluteHttpsUrl(previewImageUrl);
    if (!absolute || !preview) {
      return NextResponse.json(
        { error: "影片與預覽圖需為 HTTPS 公開網址" },
        { status: 400 },
      );
    }
    message = {
      type: "video",
      originalContentUrl: absolute,
      previewImageUrl: preview,
    };
  } else if (imageUrl) {
    const absolute = toAbsoluteHttpsUrl(imageUrl);
    if (!absolute) {
      return NextResponse.json(
        { error: "圖片網址需為 HTTPS 公開網址（請確認站點網域與上傳設定）" },
        { status: 400 },
      );
    }
    message = {
      type: "image",
      originalContentUrl: absolute,
      previewImageUrl: absolute,
    };
  } else if (text) {
    message = { type: "text", text };
  }

  if (!message) {
    return NextResponse.json({ error: "缺少 text、sticker、imageUrl 或 videoUrl" }, { status: 400 });
  }

  const pushed = await pushLineMessages(lineUserId, [message], {
    force: true,
    logAs: "staff",
  });
  if (!pushed.sent) {
    return NextResponse.json(
      { error: "推播失敗", detail: pushed },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
