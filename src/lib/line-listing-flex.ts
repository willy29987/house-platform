/** 客人端 LINE 物件卡（Flex）：中午推薦／預約送出共用。 */

import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

const BRAND_BLUE = "#2563EB";
/** 主類別（公寓／電梯大樓…）：藍灰底，與價格藍、橘底標籤區隔 */
const TYPE_BG = "#E0E7FF";
const TYPE_FG = "#3730A3";
/** 特色標籤（可寵／車位…）：暖橘底 */
const TAG_BG = "#FFEDD5";
const TAG_FG = "#9A3412";

/** 各欄固定高度，carousel 不會因內容多寡高低不一 */
const ROW_ADDRESS_H = "26px";
const ROW_TYPE_H = "26px";
const ROW_LAYOUT_H = "24px";
const ROW_PRICE_H = "36px";
const ROW_TAGS_H = "26px";

/** 客人可見建物／類別中文（電梯大樓用全稱） */
const CARD_PROPERTY_TYPE_LABEL: Record<string, string> = {
  APARTMENT: "公寓",
  ELEVATOR_BUILDING: "電梯大樓",
  VILLA: "別墅",
  HOUSE: "透天厝",
  STUDIO: "獨立套房",
  SUITE: "分租套房",
  OFFICE: "辦公",
  SHOP: "店面",
};

/** 在 LINE 內開這間的詳情，不導去官網（避免客人逛到其他物件） */
function listingUrl(id: string) {
  return `https://liff.line.me/${LINE_LIFF_RENT_ASSISTANT_ID}?listingId=${encodeURIComponent(id)}`;
}

/**
 * 地址只公開到路／街（含段），不顯示巷、弄、門牌。
 * 例：金城路三段139巷 → 金城路三段
 */
function guestFacingStreet(address: string) {
  const text = address.replace(/\s+/g, "").trim();
  if (!text) return "";
  return (text.split(/[巷弄]/)[0] ?? text)
    .replace(/\d*號.*$/, "")
    .replace(/\d+$/, "")
    .trim();
}

function layoutLabel(
  item: Pick<
    RentalMatchListing,
    "propertyType" | "houseCondition" | "rooms" | "livingRooms" | "bathrooms" | "balconies"
  >,
) {
  const condition = item.houseCondition || item.propertyType;
  if (condition === "STUDIO") return "獨立套房";
  if (condition === "SUITE") return "分租套房";
  return [
    `${item.rooms}房`,
    item.livingRooms != null ? `${item.livingRooms}廳` : null,
    `${item.bathrooms}衛`,
    item.balconies != null && item.balconies > 0 ? `${item.balconies}陽台` : null,
  ]
    .filter(Boolean)
    .join("");
}

/** 市＋區＋路／街（無分隔點、不含巷弄門牌） */
function cardAddressLine(listing: RentalMatchListing) {
  const city = (listing.city || "").trim().replace(/^臺/, "台");
  const district = (listing.district || "").trim();
  const place = `${city}${district}`;
  let street = guestFacingStreet(listing.address);
  if (city) {
    street = street.replace(city, "").replace(city.replace(/^台/, "臺"), "");
  }
  if (district) street = street.replace(district, "");
  street = street.trim();
  return `${place}${street}` || "出租物件";
}

function propertyTypeChipLabel(listing: RentalMatchListing): string {
  const raw = (listing.propertyType || "").trim();
  if (!raw) return "";
  return CARD_PROPERTY_TYPE_LABEL[raw] ?? raw;
}

function communityLabel(listing: RentalMatchListing): string {
  return (listing.community || "").trim();
}

/** 特色標籤：寵物／車位／租補／報稅／入戶籍 */
function featureTags(listing: RentalMatchListing): string[] {
  const tags: string[] = [];
  if (listing.petsAllowed === true) tags.push("可寵");
  else if (listing.petsAllowed === false) tags.push("不可寵");
  if (
    (listing.parkingType || "").trim() ||
    (listing.areaParkingSpace != null && listing.areaParkingSpace > 0) ||
    (listing.parkingRent != null && listing.parkingRent > 0)
  ) {
    tags.push("車位");
  }
  if (listing.rentSubsidy === true) tags.push("租補");
  if (listing.taxDeductible === true) tags.push("報稅");
  if (listing.canRegisterAddress === true) tags.push("入戶籍");
  return tags;
}

function chip(label: string, bg: string, fg: string) {
  return {
    type: "box",
    layout: "vertical",
    flex: 0,
    backgroundColor: bg,
    cornerRadius: "6px",
    paddingAll: "5px",
    paddingStart: "8px",
    paddingEnd: "8px",
    contents: [
      {
        type: "text",
        text: label,
        size: "xs",
        color: fg,
        weight: "bold",
      },
    ],
  };
}

function tagChip(label: string) {
  return chip(label, TAG_BG, TAG_FG);
}

/** 類別框＋可選社區名（無社區就不顯示） */
function typeCommunityRow(listing: RentalMatchListing) {
  const typeLabel = propertyTypeChipLabel(listing);
  const community = communityLabel(listing);
  const contents: Record<string, unknown>[] = [];
  if (typeLabel) {
    contents.push(chip(typeLabel, TYPE_BG, TYPE_FG));
  }
  if (community) {
    contents.push({
      type: "text",
      text: community.slice(0, 20),
      size: "sm",
      color: "#374151",
      weight: "bold",
      flex: 1,
      wrap: false,
      maxLines: 1,
    });
  }
  if (!contents.length) contents.push({ type: "filler" });
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    height: ROW_TYPE_H,
    alignItems: "center",
    contents,
  };
}

function fixedRow(height: string, contents: Record<string, unknown>[], opts?: { margin?: string }) {
  return {
    type: "box",
    layout: "vertical",
    height,
    justifyContent: "center",
    ...(opts?.margin ? { margin: opts.margin } : {}),
    contents,
  };
}

function listingBubble(listing: RentalMatchListing) {
  const uri = listingUrl(listing.id);
  const image = listing.images[0] || listing.coverImage || "";
  const address = cardAddressLine(listing);
  const layout = layoutLabel(listing);
  const area =
    listing.areaPing > 0
      ? `${Number.isInteger(listing.areaPing) ? listing.areaPing : listing.areaPing.toFixed(1)}坪`
      : "";
  const row2 = [layout, area].filter(Boolean).join(" · ") || "—";
  const tags = featureTags(listing);

  const typeRow = typeCommunityRow(listing);
  const body: Record<string, unknown>[] = [
    fixedRow(ROW_ADDRESS_H, [
      {
        type: "text",
        text: address.slice(0, 80),
        weight: "bold",
        size: "lg",
        color: "#111111",
        wrap: false,
        maxLines: 1,
      },
    ]),
    { ...typeRow, margin: "sm" },
    fixedRow(
      ROW_LAYOUT_H,
      [
        {
          type: "text",
          text: row2,
          size: "md",
          color: "#374151",
          weight: "bold",
          wrap: false,
          maxLines: 1,
        },
      ],
      { margin: "sm" },
    ),
    // 剩餘空間留給價格區，標籤貼近底部「物件詳情」
    { type: "filler" },
    fixedRow(
      ROW_PRICE_H,
      [
        {
          type: "text",
          // LINE Flex 字重只有 regular／bold，無法再加粗 30%；維持 bold、不放大字級
          text: listing.price > 0 ? `${listing.price.toLocaleString("zh-TW")} 元/月` : "租金另議",
          weight: "bold",
          size: "xl",
          color: BRAND_BLUE,
          wrap: false,
          maxLines: 1,
        },
      ],
      { margin: "md" },
    ),
    {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "md",
      height: ROW_TAGS_H,
      contents: tags.length ? tags.slice(0, 5).map(tagChip) : [{ type: "filler" }],
    },
  ];

  return {
    type: "bubble",
    size: "kilo",
    ...(image.startsWith("https://")
      ? {
          hero: {
            type: "image",
            url: image,
            size: "full",
            // 圖片再高一點，避免裁切太狠
            aspectRatio: "20:14",
            aspectMode: "cover",
            action: { type: "uri", uri },
          },
        }
      : {}),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "12px",
      paddingBottom: "8px",
      contents: body,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "8px",
      paddingTop: "4px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: BRAND_BLUE,
          height: "sm",
          action: { type: "uri", label: "物件詳情", uri },
        },
      ],
    },
  };
}

export function digestGreetingText(count: number) {
  return `您好～今天有${count}筆符合您的物件！趕快點開看看～`;
}

export function buildListingCardsFlex(
  listings: RentalMatchListing[],
  /** 完整 altText；不傳則用簡短預設 */
  altText?: string,
) {
  const bubbles = listings.slice(0, 10).map(listingBubble);
  if (!bubbles.length) return null;
  const resolvedAlt = altText?.trim() || digestGreetingText(listings.length);
  return {
    type: "flex" as const,
    altText: resolvedAlt.slice(0, 400),
    contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
  };
}
