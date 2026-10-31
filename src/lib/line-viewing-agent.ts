/** 業務 LINE 確認／改約看屋時間。 */

import {
  findAgentProposingCase,
  getLineRentalCase,
  updateLineRentalCase,
  type LineRentalCase,
} from "@/lib/line-rental-cases";
import {
  buildLiffRentAssistantUrl,
  pushLineMessages,
  replyLineMessages,
  truncateLineTemplateText,
  type LineMessage,
} from "@/lib/line-messaging";

export function getViewingAgentUserIds(): string[] {
  const raw = process.env.LINE_VIEWING_AGENT_USER_IDS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isViewingAgentUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getViewingAgentUserIds().includes(userId);
}

export function viewingPostbackData(
  action: "approve" | "propose" | "guest_accept",
  caseId: string,
): string {
  return `viewing:${action}:${caseId}`;
}

export function parseViewingPostback(
  data: string,
): { action: "approve" | "propose" | "guest_accept"; caseId: string } | null {
  const match = data.match(/^viewing:(approve|propose|guest_accept):(.+)$/);
  if (!match) return null;
  return {
    action: match[1] as "approve" | "propose" | "guest_accept",
    caseId: match[2],
  };
}

function listingTitles(caseRecord: LineRentalCase): string {
  if (!caseRecord.picked.length) return "出租物件";
  return caseRecord.picked.map((p) => p.title).join("、");
}

function agentAskText(caseRecord: LineRentalCase): string {
  const titles = listingTitles(caseRecord);
  const when = caseRecord.requestedWhen;
  const phone = caseRecord.phone ? `電話 ${caseRecord.phone}` : "";
  const name = caseRecord.displayName || "客人";
  return truncateLineTemplateText(
    `${name} 想看「${titles}」\n希望時段：${when}${phone ? `\n${phone}` : ""}\n這個時間可以嗎？`,
  );
}

export function buildAgentConfirmMessage(caseRecord: LineRentalCase): LineMessage {
  return {
    type: "template",
    altText: `約看確認：${caseRecord.requestedWhen}`,
    template: {
      type: "confirm",
      text: agentAskText(caseRecord),
      actions: [
        {
          type: "postback",
          label: "可以",
          data: viewingPostbackData("approve", caseRecord.id),
          displayText: "可以",
        },
        {
          type: "postback",
          label: "改時間",
          data: viewingPostbackData("propose", caseRecord.id),
          displayText: "改時間",
        },
      ],
    },
  };
}

export function buildGuestRescheduleConfirmMessage(caseRecord: LineRentalCase): LineMessage {
  const when = caseRecord.proposedWhen || caseRecord.requestedWhen;
  return {
    type: "template",
    altText: `業務建議改約：${when}`,
    template: {
      type: "confirm",
      text: truncateLineTemplateText(
        `業務回覆：原先時段暫無法安排，建議改為「${when}」。可以嗎？`,
      ),
      actions: [
        {
          type: "postback",
          label: "接受新時間",
          data: viewingPostbackData("guest_accept", caseRecord.id),
          displayText: "接受新時間",
        },
        {
          type: "uri",
          label: "另選時間",
          uri: buildLiffRentAssistantUrl(),
        },
      ],
    },
  };
}

/** 客人送出後通知所有業務；回傳是否有推到至少一位 */
export async function notifyAgentsOfNewViewing(caseRecord: LineRentalCase): Promise<{
  notified: number;
  agentIds: string[];
}> {
  const agentIds = getViewingAgentUserIds();
  if (!agentIds.length) return { notified: 0, agentIds: [] };

  const message = buildAgentConfirmMessage(caseRecord);
  let notified = 0;
  await Promise.all(
    agentIds.map(async (agentId) => {
      const result = await pushLineMessages(agentId, [message]);
      if (result.sent) notified += 1;
    }),
  );
  return { notified, agentIds };
}

function alreadyHandledReply(caseRecord: LineRentalCase): LineMessage {
  return {
    type: "text",
    text: `此約看已由同事處理（狀態：${caseRecord.status}）。`,
  };
}

async function claimCase(
  caseRecord: LineRentalCase,
  agentLineUserId: string,
  nextStatus: "confirmed" | "agent_proposing",
): Promise<{ ok: true; case: LineRentalCase } | { ok: false; case: LineRentalCase; reason: "taken" }> {
  if (caseRecord.status === "confirmed") {
    return { ok: false, case: caseRecord, reason: "taken" };
  }
  if (
    caseRecord.handledByAgentLineUserId &&
    caseRecord.handledByAgentLineUserId !== agentLineUserId &&
    caseRecord.status !== "awaiting_agent"
  ) {
    return { ok: false, case: caseRecord, reason: "taken" };
  }
  if (caseRecord.status !== "awaiting_agent" && caseRecord.status !== "pending_confirm") {
    if (
      caseRecord.handledByAgentLineUserId === agentLineUserId &&
      caseRecord.status === "agent_proposing" &&
      nextStatus === "agent_proposing"
    ) {
      return { ok: true, case: caseRecord };
    }
    return { ok: false, case: caseRecord, reason: "taken" };
  }

  const updated = await updateLineRentalCase(caseRecord.id, {
    status: nextStatus,
    handledByAgentLineUserId: agentLineUserId,
    summaryText:
      nextStatus === "confirmed"
        ? `業務已確認看屋時間（${caseRecord.requestedWhen}）。`
        : `業務準備改約時間（原希望：${caseRecord.requestedWhen}）。`,
  });
  if (!updated) return { ok: false, case: caseRecord, reason: "taken" };
  return { ok: true, case: updated };
}

export async function handleViewingAgentPostback(input: {
  replyToken: string;
  agentLineUserId: string;
  data: string;
}): Promise<boolean> {
  const parsed = parseViewingPostback(input.data);
  if (!parsed || parsed.action === "guest_accept") return false;
  if (!isViewingAgentUserId(input.agentLineUserId)) {
    await replyLineMessages(input.replyToken, [
      { type: "text", text: "這個操作僅限設定的業務帳號。" },
    ]);
    return true;
  }

  const caseRecord = await getLineRentalCase(parsed.caseId);
  if (!caseRecord) {
    await replyLineMessages(input.replyToken, [{ type: "text", text: "找不到這筆約看案件。" }]);
    return true;
  }

  if (parsed.action === "approve") {
    const claimed = await claimCase(caseRecord, input.agentLineUserId, "confirmed");
    if (!claimed.ok) {
      await replyLineMessages(input.replyToken, [alreadyHandledReply(claimed.case)]);
      return true;
    }
    const when = claimed.case.requestedWhen;
    await replyLineMessages(input.replyToken, [
      { type: "text", text: `已確認「${when}」。系統會通知客人。` },
    ]);
    if (claimed.case.lineUserId) {
      await pushLineMessages(claimed.case.lineUserId, [
        {
          type: "text",
          text: `${when} 可以，同事會再跟你說帶看的人。`,
        },
      ]);
    }
    return true;
  }

  // propose
  const claimed = await claimCase(caseRecord, input.agentLineUserId, "agent_proposing");
  if (!claimed.ok) {
    await replyLineMessages(input.replyToken, [alreadyHandledReply(claimed.case)]);
    return true;
  }
  await replyLineMessages(input.replyToken, [
    {
      type: "text",
      text: "請直接回覆新的看屋時間文字，例如「11/5 下午 14:00」。送出後會立刻問客人可不可以。",
    },
  ]);
  return true;
}

export async function handleViewingGuestPostback(input: {
  replyToken: string;
  guestLineUserId: string;
  data: string;
}): Promise<boolean> {
  const parsed = parseViewingPostback(input.data);
  if (!parsed || parsed.action !== "guest_accept") return false;
  await handleGuestAccept({
    replyToken: input.replyToken,
    guestLineUserId: input.guestLineUserId,
    caseId: parsed.caseId,
  });
  return true;
}

async function handleGuestAccept(input: {
  replyToken: string;
  guestLineUserId: string;
  caseId: string;
}) {
  const caseRecord = await getLineRentalCase(input.caseId);
  if (!caseRecord) {
    await replyLineMessages(input.replyToken, [{ type: "text", text: "找不到這筆約看案件。" }]);
    return;
  }
  if (caseRecord.status === "confirmed") {
    await replyLineMessages(input.replyToken, [
      { type: "text", text: `這筆約看已確認為「${caseRecord.requestedWhen}」。` },
    ]);
    return;
  }
  if (caseRecord.status !== "reschedule_sent") {
    await replyLineMessages(input.replyToken, [
      { type: "text", text: "這筆約看目前無法接受新時間，請稍候或重新選時。" },
    ]);
    return;
  }
  if (caseRecord.lineUserId && caseRecord.lineUserId !== input.guestLineUserId) {
    await replyLineMessages(input.replyToken, [{ type: "text", text: "這不是你的約看案件。" }]);
    return;
  }

  const when = caseRecord.proposedWhen || caseRecord.requestedWhen;
  const updated = await updateLineRentalCase(caseRecord.id, {
    status: "confirmed",
    requestedWhen: when,
    summaryText: `客人已接受業務改約時間（${when}）。`,
  });
  await replyLineMessages(input.replyToken, [
    { type: "text", text: `好，已改為「${when}」。同事會再跟你說帶看細節。` },
  ]);
  const agentId = updated?.handledByAgentLineUserId;
  if (agentId) {
    await pushLineMessages(agentId, [
      {
        type: "text",
        text: `客人已接受改約「${when}」（${caseRecord.displayName}／${listingTitles(caseRecord)}）。`,
      },
    ]);
  }
}

/** 業務在 agent_proposing 狀態下回傳新時間文字 */
export async function handleAgentProposeText(input: {
  replyToken: string;
  agentLineUserId: string;
  text: string;
}): Promise<boolean> {
  if (!isViewingAgentUserId(input.agentLineUserId)) return false;
  const caseRecord = await findAgentProposingCase(input.agentLineUserId);
  if (!caseRecord) return false;

  const proposedWhen = input.text.trim();
  if (!proposedWhen || proposedWhen.length > 120) {
    await replyLineMessages(input.replyToken, [
      { type: "text", text: "請回覆較短的時間描述，例如「11/5 下午 14:00」。" },
    ]);
    return true;
  }

  const updated = await updateLineRentalCase(caseRecord.id, {
    status: "reschedule_sent",
    proposedWhen,
    summaryText: `業務提案改約為「${proposedWhen}」（原希望：${caseRecord.requestedWhen}），待客人確認。`,
  });
  if (!updated) {
    await replyLineMessages(input.replyToken, [{ type: "text", text: "更新失敗，請稍後再試。" }]);
    return true;
  }

  await replyLineMessages(input.replyToken, [
    { type: "text", text: `已送出新時間「${proposedWhen}」給客人確認。` },
  ]);

  if (updated.lineUserId) {
    await pushLineMessages(updated.lineUserId, [buildGuestRescheduleConfirmMessage(updated)]);
  }
  return true;
}
