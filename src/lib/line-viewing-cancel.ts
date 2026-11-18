/** 約看取消：寫回案件狀態並通知對方 */

import {
  CANCELLABLE_VIEWING_STATUSES,
  getLineRentalCase,
  updateLineRentalCase,
  type LineRentalCase,
  type LineRentalCaseCancelledBy,
} from "@/lib/line-rental-cases";
import {
  buildViewingCancelGuestUrl,
  pushLineMessages,
  replyLineMessages,
  type LineMessage,
} from "@/lib/line-messaging";
import {
  VIEWING_CANCELLED_GUEST_TEXT,
  VIEWING_CANCELLED_STAFF_TEXT,
  buildGuestViewingManageMessage,
} from "@/lib/line-viewing-guest-copy";

function listingTitles(caseRecord: LineRentalCase): string {
  if (!caseRecord.picked.length) return "出租物件";
  return caseRecord.picked.map((p) => p.title).join("、");
}

export function canCancelViewing(caseRecord: LineRentalCase): boolean {
  return caseRecord.kind === "viewing" && CANCELLABLE_VIEWING_STATUSES.has(caseRecord.status);
}

export async function cancelViewingCase(input: {
  caseId: string;
  cancelledBy: LineRentalCaseCancelledBy;
  actorLineUserId?: string | null;
  cancelNote?: string;
  /** 業務 postback 時用 reply；其餘 push */
  replyToken?: string | null;
}): Promise<
  | { ok: true; case: LineRentalCase; alreadyCancelled: boolean }
  | { ok: false; error: string }
> {
  const caseId = input.caseId.trim();
  if (!caseId) return { ok: false, error: "缺少約看案件" };

  const caseRecord = await getLineRentalCase(caseId);
  if (!caseRecord) return { ok: false, error: "找不到約看案件" };
  if (caseRecord.kind !== "viewing") return { ok: false, error: "此案件不是約看" };

  if (caseRecord.status === "cancelled") {
    return { ok: true, case: caseRecord, alreadyCancelled: true };
  }
  if (!canCancelViewing(caseRecord)) {
    return { ok: false, error: "此約看目前無法取消" };
  }

  if (input.cancelledBy === "guest") {
    const actor = input.actorLineUserId?.trim() || "";
    if (caseRecord.lineUserId && actor && caseRecord.lineUserId !== actor) {
      return { ok: false, error: "這不是你的約看案件" };
    }
  }

  const when = caseRecord.proposedWhen || caseRecord.requestedWhen || "未填時段";
  const byLabel =
    input.cancelledBy === "guest" ? "客人" : input.cancelledBy === "agent" ? "業務" : "客服";
  const note = input.cancelNote?.trim() || "";
  const updated = await updateLineRentalCase(caseId, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelledBy: input.cancelledBy,
    cancelNote: note,
    summaryText: `${byLabel}已取消約看（${when}）${note ? `：${note}` : ""}`,
    handledByAgentLineUserId:
      input.cancelledBy === "agent" && input.actorLineUserId
        ? input.actorLineUserId
        : caseRecord.handledByAgentLineUserId,
  });
  if (!updated) return { ok: false, error: "取消失敗，請稍後再試" };

  const guestText = VIEWING_CANCELLED_GUEST_TEXT;
  const staffText = VIEWING_CANCELLED_STAFF_TEXT({
    name: caseRecord.displayName,
    when,
    titles: listingTitles(caseRecord),
    cancelledBy: input.cancelledBy,
  });

  if (input.cancelledBy === "guest") {
    if (input.replyToken) {
      await replyLineMessages(input.replyToken, [{ type: "text", text: guestText }]);
    } else if (caseRecord.lineUserId) {
      await pushLineMessages(caseRecord.lineUserId, [{ type: "text", text: guestText }], {
        force: true,
      });
    }
    const agentId = updated.handledByAgentLineUserId;
    if (agentId) {
      await pushLineMessages(agentId, [{ type: "text", text: staffText }], { force: true });
    }
  } else {
    if (caseRecord.lineUserId) {
      await pushLineMessages(caseRecord.lineUserId, [{ type: "text", text: guestText }], {
        force: true,
      });
    }
    if (input.replyToken) {
      await replyLineMessages(input.replyToken, [{ type: "text", text: `已取消並通知客人（${when}）。` }]);
    } else if (updated.handledByAgentLineUserId && input.cancelledBy === "staff") {
      await pushLineMessages(
        updated.handledByAgentLineUserId,
        [{ type: "text", text: staffText }],
        { force: true },
      );
    }
  }

  return { ok: true, case: updated, alreadyCancelled: false };
}

/** 確認後附在客人聊天：改時間／取消入口 */
export function buildGuestViewingManageFlex(caseRecord: LineRentalCase): LineMessage {
  return buildGuestViewingManageMessage({
    caseId: caseRecord.id,
    when: caseRecord.requestedWhen || caseRecord.proposedWhen || "已確認時段",
    cancelUrl: buildViewingCancelGuestUrl(caseRecord.id),
  });
}
