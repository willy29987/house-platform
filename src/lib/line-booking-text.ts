/** 找房預約原文的整理。LINE 傳訊網址若帶 text=，客人送出後會多出「text:」。 */

import type { LineRentalCasePicked } from "@/lib/line-rental-cases";

export function stripBookingTransportPrefix(text: string) {
  return text.replace(/^(?:text\s*[:=：]\s*)+/i, "").trim();
}

export function applyLineDisplayName(summary: string, displayName: string) {
  const name = displayName.trim();
  if (!name || name === "LINE 客人") return summary;
  if (!summary.includes("暱稱：")) return summary;
  return summary.replace(/暱稱：[^\n]*/, `暱稱：${name}`);
}

export type ParsedGuestBooking = {
  phone: string;
  requestedWhen: string;
  occupation: string;
  nationality: string;
  peopleCount: number;
  petNote: string;
  moveInDate: string;
  criteriaText: string;
  nickname: string;
  picked: LineRentalCasePicked[];
  summaryText: string;
};

function field(text: string, label: string) {
  const match = text.match(new RegExp(`${label}：([^\\n]*)`));
  return match?.[1]?.trim() ?? "";
}

function pickedFromBooking(text: string): LineRentalCasePicked[] {
  const picked: LineRentalCasePicked[] = [];
  const pattern = /(\d+)\.\s+([^\n]+)\n(https?:\/\/[^\s]+)/g;
  for (const match of text.matchAll(pattern)) {
    const line = match[2].trim();
    const priceMatch = line.match(/（([\d,]+)\s*元\/月）\s*$/);
    const title = priceMatch ? line.slice(0, priceMatch.index).trim() : line;
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) || 0 : 0;
    const id = match[3].match(/\/listings\/([^/?#]+)/)?.[1]?.trim() ?? "";
    if (!title) continue;
    picked.push({ id, title, price });
  }
  return picked;
}

export function parseGuestBookingMessage(raw: string): ParsedGuestBooking | null {
  const summaryText = stripBookingTransportPrefix(raw);
  if (!summaryText.includes("【找房預約】")) return null;
  const phone = field(summaryText, "電話");
  const requestedWhen = field(summaryText, "看屋時間");
  if (!phone || !requestedWhen) return null;
  const people = Number(field(summaryText, "人數").match(/\d+/)?.[0] ?? "1");
  return {
    phone,
    requestedWhen,
    occupation: field(summaryText, "職業"),
    nationality: field(summaryText, "國籍"),
    peopleCount: Number.isFinite(people) && people >= 1 ? Math.min(6, Math.round(people)) : 1,
    petNote: field(summaryText, "寵物"),
    moveInDate: field(summaryText, "預計入住"),
    criteriaText: field(summaryText, "條件"),
    nickname: field(summaryText, "暱稱"),
    picked: pickedFromBooking(summaryText),
    summaryText,
  };
}
