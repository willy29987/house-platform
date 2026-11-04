/** 約看流程對客人的固定文案 */

export const VIEWING_SUBMIT_ACK_TEXT =
  "好的～稍等確認完帶看人員時間跟您說，請稍等😃";

export const VIEWING_ASK_OTHER_TIME_TEXT =
  "不好意思，您選的時間沒有辦法安排帶看，請問您其他方便的時間是什麼時候呢？";

export function buildGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/** 客服／業務點「可以這個時間」後傳給客人的內容；時間帶入實際確認時段 */
export function buildViewingConfirmedGuestText(
  when: string,
  addresses: string[] = [],
): string {
  const parts = [`${when} 可以幫您安排帶看～`];
  const maps = addresses
    .map((item) => item.trim())
    .filter(Boolean)
    .map(buildGoogleMapsSearchUrl);
  if (maps.length) {
    parts.push("", ...maps);
  }
  parts.push("", "直接到這邊就可以嘍～感謝您。");
  return parts.join("\n");
}
