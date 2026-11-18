/** 約看流程對客人的固定文案 */

import type { LineMessage } from "@/lib/line-messaging";

export const VIEWING_SUBMIT_ACK_TEXT =
  "收到～幫您確認物件是否還在，確認完跟您說～";

export const VIEWING_ASK_OTHER_TIME_TEXT =
  "不好意思，您選的時間沒有辦法安排帶看，請問您其他方便的時間是什麼時候呢？";

export const VIEWING_CANCELLED_GUEST_TEXT =
  "好的，這次看屋已取消。若之後想再約，回官方帳點「開始找房」即可。";

export function VIEWING_CANCELLED_STAFF_TEXT(input: {
  name: string;
  when: string;
  titles: string;
  cancelledBy: "guest" | "agent" | "staff";
}): string {
  const who =
    input.cancelledBy === "guest" ? "客人" : input.cancelledBy === "agent" ? "業務" : "客服";
  return `${who}已取消約看：${input.name}／${input.when}／${input.titles}`;
}

/** 確認後給客人：取消入口 */
export function buildGuestViewingManageMessage(input: {
  caseId: string;
  when: string;
  cancelUrl: string;
}): LineMessage {
  return {
    type: "flex",
    altText: `約看已確認（${input.when}）· 可取消`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "約看已安排",
            weight: "bold",
            size: "md",
            color: "#0b2545",
          },
          {
            type: "text",
            text: input.when,
            size: "sm",
            color: "#374151",
            wrap: true,
            margin: "xs",
          },
          {
            type: "text",
            text: "時間不方便可取消，再重新預約。",
            size: "xs",
            color: "#6B7280",
            wrap: true,
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: "取消這次預約",
              uri: input.cancelUrl,
            },
            color: "#E5E7EB",
          },
        ],
      },
      styles: {
        footer: { separator: true },
      },
    },
  };
}

export function buildGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

export type ViewingConfirmListing = {
  title: string;
  pageUrl: string;
  address?: string;
};

/**
 * 客服／業務點「可以這個時間」後傳給客人。
 * 開頭確認句 → 感謝句 → 每個物件：地圖連結（不給案件標題／官網網址）
 */
export function buildViewingConfirmedGuestText(
  when: string,
  listings: ViewingConfirmListing[] = [],
): string {
  const parts = [
    `${when} 可以幫您安排帶看～`,
    "直接到這邊就可以嘍～感謝您。",
  ];
  for (const item of listings) {
    const address = item.address?.trim();
    if (address) parts.push("", buildGoogleMapsSearchUrl(address));
  }
  return parts.join("\n");
}
