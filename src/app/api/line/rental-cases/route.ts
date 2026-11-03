import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { appendLineRentalCase, readLineRentalCases } from "@/lib/line-rental-cases";
import { pushLineMessages } from "@/lib/line-messaging";
import { getViewingAgentUserIds, notifyAgentsOfNewViewing } from "@/lib/line-viewing-agent";

export const dynamic = "force-dynamic";

type PostBody = {
  lineUserId?: string | null;
  displayName?: string;
  phone?: string;
  occupation?: string;
  nationality?: string;
  peopleCount?: number;
  petNote?: string;
  moveInDate?: string;
  criteriaText?: string;
  picked?: { id: string; title: string; price: number }[];
  requestedWhen?: string;
  summaryText?: string;
  /** 客戶端已用 liff.sendMessages 送過時略過重複 push */
  skipGuestPush?: boolean;
};

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const cases = await readLineRentalCases();
  return NextResponse.json({ cases });
}

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const requestedWhen = typeof body.requestedWhen === "string" ? body.requestedWhen.trim() : "";
  const picked = Array.isArray(body.picked) ? body.picked : [];
  if (!phone || !requestedWhen || !picked.length) {
    return NextResponse.json({ error: "缺少電話、看屋時間或想看物件" }, { status: 400 });
  }

  const hasAgents = getViewingAgentUserIds().length > 0;
  const status = hasAgents ? "awaiting_agent" : "pending_confirm";
  const clientSummary =
    typeof body.summaryText === "string" ? body.summaryText.trim() : "";
  const summaryText =
    clientSummary ||
    (hasAgents
      ? `已記下想看時間（${requestedWhen}），已送業務確認。`
      : `已記下想看時間（${requestedWhen}），待同事確認。`);
  const skipGuestPush = body.skipGuestPush === true;

  try {
    const created = await appendLineRentalCase({
      kind: "viewing",
      status,
      lineUserId: typeof body.lineUserId === "string" ? body.lineUserId.trim() || null : null,
      displayName: (typeof body.displayName === "string" && body.displayName.trim()) || "LINE 客人",
      phone,
      occupation: typeof body.occupation === "string" ? body.occupation.trim() : "",
      nationality: typeof body.nationality === "string" ? body.nationality.trim() : "",
      peopleCount: Number.isFinite(body.peopleCount) ? Number(body.peopleCount) : 1,
      petNote: typeof body.petNote === "string" ? body.petNote.trim() : "",
      moveInDate: typeof body.moveInDate === "string" ? body.moveInDate.trim() : "",
      criteriaText: typeof body.criteriaText === "string" ? body.criteriaText.trim() : "",
      picked: picked.map((item) => ({
        id: String(item.id),
        title: String(item.title),
        price: Number(item.price) || 0,
      })),
      requestedWhen,
      summaryText,
    });

    const listingBase =
      process.env.NEXT_PUBLIC_LISTING_BASE_URL?.replace(/\/$/, "") ||
      "https://house-platform.vercel.app";
    const listingLines = created.picked.map((item, index) => {
      const price =
        item.price > 0 ? `（${item.price.toLocaleString("zh-TW")} 元/月）` : "";
      return `${index + 1}. ${item.title}${price}\n${listingBase}/listings/${item.id}`;
    });
    const confirmText =
      clientSummary ||
      [
        "【找房預約】已收到你的資料：",
        "",
        `看屋時間：${created.requestedWhen}`,
        "",
        "客戶資料：",
        `暱稱：${created.displayName}`,
        `電話：${created.phone}`,
        `人數：${created.peopleCount} 人`,
        `職業：${created.occupation || "未填"}`,
        `預計入住：${created.moveInDate || "未填"}`,
        `國籍：${created.nationality || "未填"}`,
        `寵物：${created.petNote || "未填"}`,
        `條件：${created.criteriaText}`,
        "",
        "想看的物件（網頁）：",
        ...listingLines,
      ].join("\n");

    let pushSent = false;
    if (created.lineUserId && !skipGuestPush) {
      // force：表單確認必須推到對話，不依賴 LINE_ASSISTANT_LIVE
      const pushed = await pushLineMessages(
        created.lineUserId,
        [{ type: "text", text: confirmText }],
        { force: true },
      );
      pushSent = pushed.sent;
      if (!pushed.sent) {
        console.warn("[line/rental-cases] guest confirm push failed", pushed);
      }
    }

    const notify = await notifyAgentsOfNewViewing(created);

    return NextResponse.json({
      id: created.id,
      case: created,
      agentsNotified: notify.notified,
      pushSent,
      confirmText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "寫入失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
