/** 業務 LINE 確認／改約看屋時間。 */

import {
  findAgentProposingCase,
  getLineRentalCase,
  updateLineRentalCase,
  type LineRentalCase,
} from "@/lib/line-rental-cases";
import {
  buildAgentRescheduleUrl,
  buildLiffRentAssistantUrl,
  buildPublicBaseUrl,
  pushLineMessages,
  replyLineMessages,
  truncateLineTemplateText,
  type LineMessage,
} from "@/lib/line-messaging";
import {
  buildViewingConfirmedGuestText,
  type ViewingConfirmListing,
} from "@/lib/line-viewing-guest-copy";
import { prisma } from "@/lib/prisma";

async function confirmListingsForCase(
  caseRecord: LineRentalCase,
): Promise<ViewingConfirmListing[]> {
  const picked = caseRecord.picked.filter((item) => item.id);
  if (!picked.length) return [];
  const base =
    process.env.NEXT_PUBLIC_LISTING_BASE_URL?.replace(/\/$/, "") ||
    buildPublicBaseUrl() ||
    "https://house-platform.vercel.app";
  if (!process.env.DATABASE_URL) {
    return picked.map((item) => ({
      title: item.title,
      pageUrl: `${base}/listings/${item.id}`,
    }));
  }
  try {
    const rows = await prisma.listing.findMany({
      where: { id: { in: picked.map((item) => item.id) } },
      select: { id: true, title: true, address: true, city: true, district: true },
    });
    return picked.map((item) => {
      const row = rows.find((entry) => entry.id === item.id);
      const address =
        row?.address?.trim() ||
        `${row?.city || ""}${row?.district || ""}`.trim() ||
        undefined;
      return {
        title: row?.title?.trim() || item.title,
        pageUrl: `${base}/listings/${item.id}`,
        address,
      };
    });
  } catch (error) {
    console.warn("[line-viewing-agent] confirmListingsForCase failed", error);
    return picked.map((item) => ({
      title: item.title,
      pageUrl: `${base}/listings/${item.id}`,
    }));
  }
}

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

function agentProfileLines(caseRecord: LineRentalCase): string[] {
  const lines: string[] = [];
  if (caseRecord.phone) lines.push(`電話 ${caseRecord.phone}`);
  if (caseRecord.peopleCount > 0) lines.push(`入住 ${caseRecord.peopleCount} 人`);
  if (caseRecord.occupation) lines.push(`職業 ${caseRecord.occupation}`);
  if (caseRecord.nationality) lines.push(`國籍 ${caseRecord.nationality}`);
  if (caseRecord.moveInDate) lines.push(`預計入住 ${caseRecord.moveInDate}`);
  if (caseRecord.petNote) lines.push(`寵物 ${caseRecord.petNote}`);
  return lines;
}

function flexRow(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      {
        type: "text",
        text: label,
        size: "sm",
        color: "#6B7280",
        flex: 3,
        wrap: true,
      },
      {
        type: "text",
        text: value.slice(0, 200) || "—",
        size: "sm",
        color: "#111827",
        flex: 7,
        wrap: true,
        weight: label === "時段" || label === "物件" ? "bold" : "regular",
      },
    ],
  };
}

/** 業務約看通知：時間＋物件＋個資濃縮成一則 Flex（含可以／改時間）。 */
export function buildAgentConfirmMessage(caseRecord: LineRentalCase): LineMessage {
  const name = caseRecord.displayName || "客人";
  const when = caseRecord.requestedWhen || "未填時段";
  const titles = listingTitles(caseRecord);
  const profile = agentProfileLines(caseRecord);
  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: "新約看待確認",
      weight: "bold",
      size: "md",
      color: "#111827",
    },
    {
      type: "text",
      text: name,
      weight: "bold",
      size: "lg",
      color: "#2563EB",
      wrap: true,
      margin: "sm",
    },
    { type: "separator", margin: "md" },
    {
      type: "box",
      layout: "vertical",
      margin: "md",
      spacing: "sm",
      contents: [
        flexRow("時段", when),
        flexRow("物件", titles),
        ...profile.map((line) => {
          const space = line.indexOf(" ");
          const label = space > 0 ? line.slice(0, space) : "資料";
          const value = space > 0 ? line.slice(space + 1) : line;
          return flexRow(label, value);
        }),
      ],
    },
  ];

  return {
    type: "flex",
    altText: `約看確認：${name}／${when}／${titles}`.slice(0, 400),
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#2563EB",
            height: "sm",
            action: {
              type: "postback",
              label: "可以這個時間",
              data: viewingPostbackData("approve", caseRecord.id),
              displayText: "可以",
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: "改時間",
              uri: buildAgentRescheduleUrl(caseRecord.id),
            },
          },
        ],
      },
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
      const result = await pushLineMessages(agentId, [message], { force: true });
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
      const listings = await confirmListingsForCase(claimed.case);
      await pushLineMessages(
        claimed.case.lineUserId,
        [
          {
            type: "text",
            text: buildViewingConfirmedGuestText(when, listings),
          },
        ],
        { force: true },
      );
    }
    return true;
  }

  // propose（舊 postback；新流程改開選時間頁）
  const claimed = await claimCase(caseRecord, input.agentLineUserId, "agent_proposing");
  if (!claimed.ok) {
    await replyLineMessages(input.replyToken, [alreadyHandledReply(claimed.case)]);
    return true;
  }
  await replyLineMessages(input.replyToken, [
    {
      type: "template",
      altText: "請選擇新的看屋時間",
      template: {
        type: "buttons",
        text: truncateLineTemplateText("請點下方選新的看屋時間（與客服相同的日曆選單）。"),
        actions: [
          {
            type: "uri",
            label: "選看屋時間",
            uri: buildAgentRescheduleUrl(claimed.case.id),
          },
        ],
      },
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
  const listings = await confirmListingsForCase(caseRecord);
  await replyLineMessages(input.replyToken, [
    { type: "text", text: buildViewingConfirmedGuestText(when, listings) },
  ]);
  const agentId = updated?.handledByAgentLineUserId;
  if (agentId) {
    await pushLineMessages(
      agentId,
      [
        {
          type: "text",
          text: `客人已接受改約「${when}」（${caseRecord.displayName}／${listingTitles(caseRecord)}）。`,
        },
      ],
      { force: true },
    );
  }
}

/** 業務選好新時間後：更新案件並推給客人確認 */
export async function submitAgentProposedWhen(input: {
  caseId: string;
  proposedWhen: string;
  agentLineUserId?: string | null;
}): Promise<{ ok: true; case: LineRentalCase } | { ok: false; error: string }> {
  const proposedWhen = input.proposedWhen.trim();
  if (!proposedWhen || proposedWhen.length > 120) {
    return { ok: false, error: "請選擇有效的看屋時間" };
  }

  const caseRecord = await getLineRentalCase(input.caseId);
  if (!caseRecord) return { ok: false, error: "找不到約看案件" };
  if (caseRecord.status === "confirmed" || caseRecord.status === "reschedule_sent") {
    return { ok: false, error: "此約看已處理，無法再改時間" };
  }
  if (caseRecord.status !== "awaiting_agent" && caseRecord.status !== "agent_proposing" && caseRecord.status !== "pending_confirm") {
    return { ok: false, error: "此約看目前無法改時間" };
  }

  const agentId = input.agentLineUserId?.trim() || caseRecord.handledByAgentLineUserId || getViewingAgentUserIds()[0] || null;
  const updated = await updateLineRentalCase(caseRecord.id, {
    status: "reschedule_sent",
    proposedWhen,
    handledByAgentLineUserId: agentId,
    summaryText: `業務提案改約為「${proposedWhen}」（原希望：${caseRecord.requestedWhen}），待客人確認。`,
  });
  if (!updated) return { ok: false, error: "更新失敗，請稍後再試" };

  if (updated.lineUserId) {
    await pushLineMessages(updated.lineUserId, [buildGuestRescheduleConfirmMessage(updated)], {
      force: true,
    });
  }
  if (agentId) {
    await pushLineMessages(
      agentId,
      [{ type: "text", text: `已送出新時間「${proposedWhen}」給客人確認。` }],
      { force: true },
    );
  }
  return { ok: true, case: updated };
}

/** 業務在 agent_proposing 狀態下回傳新時間文字（備援） */
export async function handleAgentProposeText(input: {
  replyToken: string;
  agentLineUserId: string;
  text: string;
}): Promise<boolean> {
  if (!isViewingAgentUserId(input.agentLineUserId)) return false;
  // 圖文選單「開始找房」也會進到業務帳號，不能被當成改約時間
  if (input.text.includes("開始找房")) return false;
  const caseRecord = await findAgentProposingCase(input.agentLineUserId);
  if (!caseRecord) return false;

  const result = await submitAgentProposedWhen({
    caseId: caseRecord.id,
    proposedWhen: input.text,
    agentLineUserId: input.agentLineUserId,
  });
  if (!result.ok) {
    await replyLineMessages(input.replyToken, [{ type: "text", text: result.error }]);
    return true;
  }
  await replyLineMessages(input.replyToken, [
    { type: "text", text: `已送出新時間「${result.case.proposedWhen}」給客人確認。` },
  ]);
  return true;
}
