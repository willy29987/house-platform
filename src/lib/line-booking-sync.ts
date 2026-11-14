/** 把客人送出的找房預約掛回客服案件與右側個資。 */

import { getGuestProfileByUserId, upsertGuestProfile } from "@/lib/line-guest-profile";
import {
  applyLineDisplayName,
  parseGuestBookingMessage,
  stripBookingTransportPrefix,
} from "@/lib/line-booking-text";
import {
  getLineConversation,
  readLineConversations,
  rewriteLineConversationMessages,
} from "@/lib/line-conversations";
import { getViewingAgentUserIds, notifyAgentsOfNewViewing } from "@/lib/line-viewing-agent";
import {
  appendLineRentalCase,
  patchLineRentalCaseBooking,
  readLineRentalCases,
  type LineRentalCase,
} from "@/lib/line-rental-cases";

const SYNC_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** 客服輪詢很頻繁，預約回補不必每次都掃整包對話 */
const SYNC_MIN_INTERVAL_MS = 60_000;
let lastSyncStartedAt = 0;

function realName(name: string | undefined) {
  const value = name?.trim() ?? "";
  return value && value !== "LINE 客人" ? value : "";
}

function fillBlank(current: string, incoming: string) {
  return current.trim() || incoming.trim();
}

function sameBooking(item: LineRentalCase, phone: string, requestedWhen: string) {
  return item.kind === "viewing" && item.phone.trim() === phone && item.requestedWhen.trim() === requestedWhen;
}

async function adoptBooking(input: {
  lineUserId: string;
  displayName?: string;
  text: string;
  createdAt?: string;
  /** 只有剛進 webhook 的新訊息才通知業務，避免客服重整時重複通知 */
  notify?: boolean;
}) {
  const parsed = parseGuestBookingMessage(input.text);
  if (!parsed) return;
  const lineUserId = input.lineUserId.trim();
  if (!lineUserId) return;

  const name = realName(input.displayName) || realName(parsed.nickname) || "LINE 客人";
  const summaryText = applyLineDisplayName(
    stripBookingTransportPrefix(parsed.summaryText),
    name,
  );
  const cases = await readLineRentalCases();
  const now = Date.now();
  const owned =
    cases.find(
      (item) => item.lineUserId === lineUserId && sameBooking(item, parsed.phone, parsed.requestedWhen),
    ) ?? null;
  const unlinked =
    owned ??
    cases.find((item) => {
      if (!sameBooking(item, parsed.phone, parsed.requestedWhen)) return false;
      if (item.lineUserId === lineUserId) return false;
      const age = now - new Date(item.createdAt).getTime();
      return !item.lineUserId || (Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000);
    }) ??
    null;

  if (unlinked) {
    const next = {
      lineUserId,
      displayName: realName(unlinked.displayName) || name,
      summaryText: applyLineDisplayName(unlinked.summaryText || summaryText, name),
      phone: fillBlank(unlinked.phone, parsed.phone),
      occupation: fillBlank(unlinked.occupation, parsed.occupation),
      nationality: fillBlank(unlinked.nationality, parsed.nationality),
      peopleCount: unlinked.peopleCount > 1 ? unlinked.peopleCount : parsed.peopleCount,
      petNote: fillBlank(unlinked.petNote, parsed.petNote),
      moveInDate: fillBlank(unlinked.moveInDate, parsed.moveInDate),
      criteriaText: fillBlank(unlinked.criteriaText, parsed.criteriaText),
      picked: unlinked.picked.length ? unlinked.picked : parsed.picked,
      requestedWhen: fillBlank(unlinked.requestedWhen, parsed.requestedWhen),
    };
    const same =
      unlinked.lineUserId === next.lineUserId &&
      unlinked.displayName === next.displayName &&
      unlinked.summaryText === next.summaryText &&
      unlinked.phone === next.phone &&
      unlinked.occupation === next.occupation &&
      unlinked.nationality === next.nationality &&
      unlinked.peopleCount === next.peopleCount &&
      unlinked.petNote === next.petNote &&
      unlinked.moveInDate === next.moveInDate &&
      unlinked.criteriaText === next.criteriaText &&
      unlinked.requestedWhen === next.requestedWhen &&
      unlinked.picked.length === next.picked.length;
    if (!same) await patchLineRentalCaseBooking(unlinked.id, next);
  } else {
    if (!parsed.picked.length) return;
    const messageAt = input.createdAt ? new Date(input.createdAt).getTime() : now;
    const age = now - messageAt;
    const createWindow = input.notify ? SYNC_WINDOW_MS : 12 * 60 * 60 * 1000;
    if (!Number.isFinite(age) || age < 0 || age > createWindow) return;
    const hasAgents = getViewingAgentUserIds().length > 0;
    const created = await appendLineRentalCase({
      kind: "viewing",
      status: hasAgents ? "awaiting_agent" : "pending_confirm",
      lineUserId,
      displayName: name,
      phone: parsed.phone,
      occupation: parsed.occupation,
      nationality: parsed.nationality,
      peopleCount: parsed.peopleCount,
      petNote: parsed.petNote,
      moveInDate: parsed.moveInDate,
      criteriaText: parsed.criteriaText,
      picked: parsed.picked,
      requestedWhen: parsed.requestedWhen,
      summaryText,
    });
    if (input.notify) {
      await notifyAgentsOfNewViewing(created).catch((error) => {
        console.warn("[line-booking-sync] notify agents failed", error);
      });
      const { clearGuestRecommendationAfterBooking } = await import(
        "@/lib/line-guest-watch-notify"
      );
      await clearGuestRecommendationAfterBooking(lineUserId).catch(() => undefined);
    }
  }

  const profile = await getGuestProfileByUserId(lineUserId);
  const profileSame =
    profile?.phone === parsed.phone &&
    profile.displayName === name &&
    profile.occupation === parsed.occupation &&
    profile.nationality === parsed.nationality &&
    profile.peopleCount === parsed.peopleCount &&
    profile.petNote === parsed.petNote &&
    profile.moveInDate === parsed.moveInDate;
  if (!profileSame) {
    await upsertGuestProfile({
      lineUserId,
      displayName: name,
      phone: parsed.phone,
      occupation: parsed.occupation,
      nationality: parsed.nationality,
      peopleCount: parsed.peopleCount,
      petNote: parsed.petNote,
      moveInDate: parsed.moveInDate,
    }).catch((error) => {
      console.warn("[line-booking-sync] upsert profile failed", error);
    });
  }
}

/** 某一則對話原文進來時立刻掛回案件，並清掉 text: 前綴。 */
export async function syncGuestBookingMessage(input: {
  lineUserId: string;
  displayName?: string;
  text: string;
}) {
  if (!input.text.includes("【找房預約】")) return;
  await adoptBooking({ ...input, notify: true });
  const parsed = parseGuestBookingMessage(input.text);
  const name = realName(input.displayName) || realName(parsed?.nickname) || "";
  const cleaned = applyLineDisplayName(stripBookingTransportPrefix(input.text), name);
  if (cleaned === input.text.trim()) return;
  const conversation = await readLineConversations().then((rows) =>
    rows.find((row) => row.lineUserId === input.lineUserId.trim()),
  );
  const edits =
    conversation?.messages
      .filter((message) => message.from === "guest" && message.text.trim() === input.text.trim())
      .map((message) => ({
        lineUserId: input.lineUserId,
        messageId: message.id,
        text: cleaned,
      })) ?? [];
  if (edits.length) await rewriteLineConversationMessages(edits);
}

/** 客服打開名單時，把已在對話裡、但右側還沒資料的預約補上。 */
export async function syncRecentGuestBookings() {
  const now = Date.now();
  if (now - lastSyncStartedAt < SYNC_MIN_INTERVAL_MS) return;
  lastSyncStartedAt = now;

  const conversations = await readLineConversations();
  const edits: Array<{ lineUserId: string; messageId: string; text: string }> = [];

  for (const conversation of conversations) {
    const name = realName(conversation.displayName);
    for (const message of conversation.messages) {
      if (message.from !== "guest" || !message.text.includes("【找房預約】")) continue;
      const age = now - new Date(message.createdAt).getTime();
      if (!Number.isFinite(age) || age < 0 || age > SYNC_WINDOW_MS) continue;
      const cleaned = applyLineDisplayName(
        stripBookingTransportPrefix(message.text),
        name || parseGuestBookingMessage(message.text)?.nickname || "",
      );
      if (cleaned !== message.text) {
        edits.push({
          lineUserId: conversation.lineUserId,
          messageId: message.id,
          text: cleaned,
        });
      }
      await adoptBooking({
        lineUserId: conversation.lineUserId,
        displayName: name || conversation.displayName,
        text: cleaned,
        createdAt: message.createdAt,
        notify: false,
      });
    }
  }

  if (edits.length) {
    await rewriteLineConversationMessages(edits);
  }
}
