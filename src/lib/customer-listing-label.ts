/** 客人端物件顯示名稱：不用案件標題，改用區域／格局／坪數／租金。 */

export type CustomerListingLabelInput = {
  city?: string | null;
  district?: string | null;
  rooms?: number | null;
  livingRooms?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  areaPing?: number | null;
  price?: number | null;
  listingType?: "RENT" | "SALE" | string | null;
  community?: string | null;
  mrtStation?: string | null;
};

function layoutText(input: CustomerListingLabelInput) {
  const parts = [
    input.rooms != null ? `${input.rooms}房` : null,
    input.livingRooms != null ? `${input.livingRooms}廳` : null,
    input.bathrooms != null ? `${input.bathrooms}衛` : null,
    input.balconies != null && input.balconies > 0 ? `${input.balconies}陽台` : null,
  ].filter(Boolean);
  return parts.join("");
}

function priceText(input: CustomerListingLabelInput) {
  if (input.price == null || !(input.price > 0)) return "";
  const n = input.price.toLocaleString("zh-TW");
  if (input.listingType === "SALE") return `${n} 元`;
  return `${n} 元/月`;
}

/** 客人可見的物件標籤（不含案件標題） */
export function customerListingLabel(
  input: CustomerListingLabelInput,
  opts?: { withPrice?: boolean },
): string {
  const place = `${input.city ?? ""}${input.district ?? ""}`.trim();
  const layout = layoutText(input);
  const area =
    input.areaPing != null && input.areaPing > 0
      ? `${Number.isInteger(input.areaPing) ? input.areaPing : input.areaPing.toFixed(1)}坪`
      : "";
  const mrt = input.mrtStation?.trim() || "";
  const community = input.community?.trim() || "";
  const bits = [
    place || community || (mrt ? `${mrt}站` : ""),
    layout,
    area,
    opts?.withPrice ? priceText(input) : "",
  ].filter(Boolean);
  return bits.join(" · ") || priceText(input) || "物件";
}

/** 列表序號用：1. 板橋區 · 2房1衛 · 12坪（12000 元/月） */
export function customerListingListLine(
  index: number,
  input: CustomerListingLabelInput,
): string {
  return `${index + 1}. ${customerListingLabel(input, { withPrice: true })}`;
}
