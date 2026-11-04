/** 約看流程對客人的固定文案 */

export const VIEWING_SUBMIT_ACK_TEXT =
  "好的～稍等確認完帶看人員時間跟您說，請稍等😃";

export const VIEWING_ASK_OTHER_TIME_TEXT =
  "不好意思，您選的時間沒有辦法安排帶看，請問您其他方便的時間是什麼時候呢？";

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
 * 開頭確認句 → 感謝句 → 每個物件：標題 → 物件網址 → 地圖連結
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
    const title = item.title.trim();
    const pageUrl = item.pageUrl.trim();
    if (title) parts.push("", title);
    if (pageUrl) parts.push(pageUrl);
    const address = item.address?.trim();
    if (address) parts.push(buildGoogleMapsSearchUrl(address));
  }
  return parts.join("\n");
}
