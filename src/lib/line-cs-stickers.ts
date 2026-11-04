/** Messaging API 可發送的官方貼圖（摘自 LINE Sticker definitions） */

export type LineCsSticker = {
  packageId: string;
  stickerId: string;
  label: string;
};

export type LineCsStickerPack = {
  packageId: string;
  title: string;
  stickers: LineCsSticker[];
};

function pack(
  packageId: string,
  title: string,
  ids: Array<[string, string]>,
): LineCsStickerPack {
  return {
    packageId,
    title,
    stickers: ids.map(([stickerId, label]) => ({ packageId, stickerId, label })),
  };
}

/** 客服貼圖選單：僅收錄官方允許透過 Messaging API 發送的組合 */
export const LINE_CS_STICKER_PACKS: LineCsStickerPack[] = [
  pack("11537", "熊大兔兔莎莉（動態）", [
    ["52002734", "打招呼"],
    ["52002735", "謝謝"],
    ["52002736", "OK"],
    ["52002737", "請稍等"],
    ["52002738", "辛苦了"],
    ["52002739", "讚"],
    ["52002740", "抱歉"],
    ["52002741", "加油"],
    ["52002742", "收到"],
    ["52002743", "開心"],
  ]),
  pack("6632", "LINE卡通明星（專業道歉）", [
    ["11825374", "對不起"],
    ["11825375", "抱歉"],
    ["11825376", "再給機會"],
    ["11825377", "鞠躬"],
    ["11825378", "請見諒"],
  ]),
  pack("8525", "LINE卡通明星（休閒敬語）", [
    ["16581290", "您好"],
    ["16581291", "麻煩您"],
    ["16581292", "謝謝您"],
    ["16581293", "請稍候"],
    ["16581294", "不好意思"],
  ]),
  pack("446", "Moon 特輯", [
    ["1988", "嗨"],
    ["1989", "好的"],
    ["1990", "謝謝"],
    ["1991", "抱歉"],
    ["1992", "拜拜"],
    ["1993", "開心"],
    ["2000", "OK"],
    ["2027", "請等一下"],
  ]),
  pack("789", "Sally 特輯", [
    ["10855", "嗨"],
    ["10856", "好的"],
    ["10857", "謝謝"],
    ["10858", "抱歉"],
    ["10859", "加油"],
  ]),
];

export function stickerPreviewUrl(stickerId: string) {
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(stickerId)}/android/sticker.png`;
}
