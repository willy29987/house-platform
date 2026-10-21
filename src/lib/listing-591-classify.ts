import type { Listing591Status } from "@/lib/owner-tracking-listing-checks";

const REMOVED_MARKERS = [
  "物件不存在",
  "已下架",
  "找不到此物件",
  "找不到物件",
  "此物件已下架",
  "此物件不存在",
  "查無此物件",
  "頁面不存在",
  "您訪問的頁面不存在",
  "page-not-found",
  "notFound",
];

const LIVE_MARKERS = [
  "item-id",
  "houseDetail",
  "house-detail",
  "rentDetail",
  "detail__",
  '"isOnline":true',
  "物件資訊",
  "房屋詳情",
];

export function classify591HttpResponse(httpStatus: number, body: string): Listing591Status {
  if (httpStatus === 404 || httpStatus === 410) return "removed";
  if (httpStatus === 403 || httpStatus === 429) return "unknown";
  if (httpStatus < 200 || httpStatus >= 400) return "unknown";

  const text = body.slice(0, 120_000);
  const lower = text.toLowerCase();

  for (const m of REMOVED_MARKERS) {
    if (text.includes(m) || lower.includes(m.toLowerCase())) return "removed";
  }

  if (httpStatus === 200) {
    for (const m of LIVE_MARKERS) {
      if (text.includes(m) || lower.includes(m.toLowerCase())) return "live";
    }
    if (/<title[^>]*>[^<]*(591|租屋|售屋|物件)[^<]*<\/title>/i.test(text)) {
      if (!/不存在|下架|找不到/.test(text)) return "live";
    }
  }

  return "unknown";
}
