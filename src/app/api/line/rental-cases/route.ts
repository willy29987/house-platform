import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-auth";
import {
  appendLineConversationMessage,
  findRecentGuestUserIdByExactText,
} from "@/lib/line-conversations";
import {
  appendLineRentalCase,
  appendPickedToViewingCase,
  findLatestOpenViewing,
  getLineRentalCase,
  isOpenViewingStatus,
  readLineRentalCases,
  type LineRentalCase,
  type LineRentalCasePicked,
} from "@/lib/line-rental-cases";
import { applyLineDisplayName } from "@/lib/line-booking-text";
import { getLineUserProfile, pushLineMessages } from "@/lib/line-messaging";
import { VIEWING_SUBMIT_ACK_TEXT } from "@/lib/line-viewing-guest-copy";
import { upsertGuestProfile } from "@/lib/line-guest-profile";
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
  /** 併進這一筆進行中約看，不新建 */
  mergeIntoCaseId?: string;
  /** 客戶端已用 liff.sendMessages 送過時略過重複 push */
  skipGuestPush?: boolean;
  /** 客人的 LINE 已經有這則預約原文 */
  clientDelivered?: boolean;
};

export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
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
  const skipGuestPush = body.skipGuestPush === true;
  const clientDelivered = body.clientDelivered === true;
  const fromBody = typeof body.lineUserId === "string" ? body.lineUserId.trim() || null : null;
  const fromChat =
    clientSummary.includes("【找房預約】")
      ? await findRecentGuestUserIdByExactText(clientSummary)
      : null;
  const lineUserId = fromChat || fromBody;
  let displayName =
    (typeof body.displayName === "string" && body.displayName.trim()) || "LINE 客人";
  if (lineUserId) {
    const profile = await getLineUserProfile(lineUserId);
    if (profile?.displayName) displayName = profile.displayName;
  }
  const summaryText = applyLineDisplayName(
    clientSummary ||
      (hasAgents
        ? `已記下想看時間（${requestedWhen}），已送業務確認。`
        : `已記下想看時間（${requestedWhen}），待同事確認。`),
    displayName,
  );
  const incomingPicked: LineRentalCasePicked[] = picked.map((item) => ({
    id: String(item.id),
    title: String(item.title),
    price: Number(item.price) || 0,
  }));

  try {
    const requestedMergeId =
      typeof body.mergeIntoCaseId === "string" ? body.mergeIntoCaseId.trim() : "";
    let mergeTarget: LineRentalCase | null = null;
    if (requestedMergeId) {
      const requested = await getLineRentalCase(requestedMergeId);
      if (
        requested &&
        requested.kind === "viewing" &&
        isOpenViewingStatus(requested.status) &&
        (!lineUserId || !requested.lineUserId || requested.lineUserId === lineUserId)
      ) {
        mergeTarget = requested;
      }
    }
    if (!mergeTarget && lineUserId) {
      const open = await findLatestOpenViewing(lineUserId);
      if (open && open.requestedWhen.trim() === requestedWhen) mergeTarget = open;
    }

    const created = mergeTarget
      ? await appendPickedToViewingCase(
          mergeTarget.id,
          incomingPicked,
          summaryText,
        )
      : await appendLineRentalCase({
          kind: "viewing",
          status,
          lineUserId,
          displayName,
          phone,
          occupation: typeof body.occupation === "string" ? body.occupation.trim() : "",
          nationality: typeof body.nationality === "string" ? body.nationality.trim() : "",
          peopleCount: Number.isFinite(body.peopleCount) ? Number(body.peopleCount) : 1,
          petNote: typeof body.petNote === "string" ? body.petNote.trim() : "",
          moveInDate: typeof body.moveInDate === "string" ? body.moveInDate.trim() : "",
          criteriaText: typeof body.criteriaText === "string" ? body.criteriaText.trim() : "",
          picked: incomingPicked,
          requestedWhen,
          summaryText,
        });
    if (!created) {
      return NextResponse.json({ error: "找不到要併入的約看" }, { status: 404 });
    }

    if (created.lineUserId && created.phone) {
      try {
        await upsertGuestProfile({
          lineUserId: created.lineUserId,
          displayName: created.displayName,
          phone: created.phone,
          occupation: created.occupation,
          nationality: created.nationality,
          peopleCount: created.peopleCount,
          petNote: created.petNote,
          moveInDate: created.moveInDate,
        });
      } catch (error) {
        console.warn("[line/rental-cases] upsert guest profile failed", error);
      }
    }

    const listingBase =
      process.env.NEXT_PUBLIC_LISTING_BASE_URL?.replace(/\/$/, "") ||
      "https://house-platform.vercel.app";
    const listingLines = created.picked.map((item, index) => {
      const price =
        item.price > 0 ? `（${item.price.toLocaleString("zh-TW")} 元/月）` : "";
      return `${index + 1}. ${item.title}${price}\n${listingBase}/listings/${item.id}`;
    });
    const confirmText = mergeTarget
      ? [
          "【找房預約】已加入同一時段，上一間仍保留。",
          "",
          `看屋時間：${created.requestedWhen}`,
          "",
          "想看的物件（含原先已約）：",
          ...listingLines,
        ].join("\n")
      : summaryText ||
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

    // 先把預約摘要寫進客服對話（不依賴 LIFF webhook 時序），再送「稍等確認」
    let pushSent = false;
    let pushReason = skipGuestPush ? "skipped_client_delivery" : "guest_push_disabled";
    if (created.lineUserId) {
      try {
        await appendLineConversationMessage({
          lineUserId: created.lineUserId,
          from: "guest",
          text: confirmText,
          displayName: created.displayName,
          messageId: mergeTarget
            ? `case:${created.id}:merge:${Date.now().toString(36)}`
            : `case:${created.id}:booking`,
        });
      } catch (error) {
        console.warn("[line/rental-cases] append booking to conversation failed", error);
      }

      if (!clientDelivered) {
        await pushLineMessages(
          created.lineUserId,
          [{ type: "text", text: confirmText }],
          { force: true, logAs: false },
        );
      }

      const ack = await pushLineMessages(
        created.lineUserId,
        [{ type: "text", text: VIEWING_SUBMIT_ACK_TEXT }],
        { force: true, logAs: "bot" },
      );
      pushSent = ack.sent;
      pushReason = ack.sent ? "ack_ok" : ("reason" in ack ? String(ack.reason) : "ack_failed");
    }

    const notify = await notifyAgentsOfNewViewing(created);

    return NextResponse.json({
      id: created.id,
      case: created,
      agentsNotified: notify.notified,
      pushSent,
      pushReason,
      hasLineUserId: Boolean(created.lineUserId),
      confirmText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "寫入失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
