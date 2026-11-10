/** 客人送出預約時，用 liff.sendMessages 代客人送出的物件卡（Flex）。 */

import { LINE_LIFF_RENT_ASSISTANT_ID } from "@/lib/line-liff-id";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

const BRAND_BLUE = "#2563EB";

/** 在 LINE 內開這間的詳情，不導去官網（避免客人逛到其他物件） */
function listingUrl(id: string) {
  return `https://liff.line.me/${LINE_LIFF_RENT_ASSISTANT_ID}?listingId=${encodeURIComponent(id)}`;
}

function listingBubble(listing: RentalMatchListing) {
  const uri = listingUrl(listing.id);
  const image = listing.images[0] || listing.coverImage || "";
  const meta = [
    listing.district,
    listing.rooms > 0 ? `${listing.rooms}房` : "",
    listing.areaPing > 0 ? `${listing.areaPing}坪` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const body: Record<string, unknown>[] = [
    {
      type: "text",
      text: listing.title.slice(0, 80) || "出租物件",
      weight: "bold",
      size: "sm",
      wrap: true,
      maxLines: 2,
    },
  ];
  if (listing.price > 0) {
    body.push({
      type: "text",
      text: `${listing.price.toLocaleString("zh-TW")} 元/月`,
      weight: "bold",
      size: "md",
      color: BRAND_BLUE,
    });
  }
  if (meta) body.push({ type: "text", text: meta, size: "xs", color: "#6B7280", wrap: true });

  return {
    type: "bubble",
    size: "kilo",
    ...(image.startsWith("https://")
      ? {
          hero: {
            type: "image",
            url: image,
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover",
            action: { type: "uri", uri },
          },
        }
      : {}),
    body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: BRAND_BLUE,
          height: "sm",
          action: { type: "uri", label: "看物件詳情", uri },
        },
      ],
    },
  };
}

export function buildListingCardsFlex(listings: RentalMatchListing[]) {
  const bubbles = listings.slice(0, 10).map(listingBubble);
  if (!bubbles.length) return null;
  const titles = listings.map((item) => item.title).join("、");
  return {
    type: "flex" as const,
    altText: `想看的物件：${titles}`.slice(0, 400),
    contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
  };
}
