import { is591ListingUrl, normalize591ListingUrl } from "@/lib/owner-tracking-listing-checks";

/**
 * 從 591 網址或純文字抽出物件編號。
 * 支援 rent-detail-123、sale-detail-123、?id=123、路徑末段數字等。
 */
export function extract591ListingId(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  const detail = text.match(/(?:rent|sale|home)-detail-(\d+)/i);
  if (detail?.[1]) return detail[1];

  const queryId = text.match(/[?&#](?:house|post|id)=(\d+)/i);
  if (queryId?.[1]) return queryId[1];

  try {
    const normalized = normalize591ListingUrl(text);
    if (normalized) {
      const u = new URL(normalized);
      const fromPath = u.pathname.match(/(?:rent|sale|home)-detail-(\d+)/i);
      if (fromPath?.[1]) return fromPath[1];
      const idParam = u.searchParams.get("id") || u.searchParams.get("house") || u.searchParams.get("post");
      if (idParam && /^\d+$/.test(idParam)) return idParam;
      const trailing = u.pathname.match(/\/(\d{5,})(?:\.html?)?\/?$/);
      if (trailing?.[1]) return trailing[1];
    }
  } catch {
    /* ignore */
  }

  if (/^\d{5,}$/.test(text)) return text;
  return null;
}

/** 從一段訊息中找出第一個 591 網址（若有；含 591.to 短網址、App 分享文案） */
export function find591UrlInText(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s<>"'\t]+/gi) ?? [];
  for (const candidate of matches) {
    const cleaned = candidate.replace(/[),.;]+$/g, "");
    if (/^https?:\/\/591\.to\//i.test(cleaned)) return cleaned;
    if (is591ListingUrl(cleaned)) return normalize591ListingUrl(cleaned);
  }
  // 無 protocol 的 rent.591.com.tw/... 或 591.to/...
  const bare = text.match(/(?:(?:rent|sale|www)\.591\.com\.tw|591\.to)\/[^\s<>"'\t]+/i);
  if (bare?.[0]) {
    const withProto = bare[0].startsWith("http") ? bare[0] : `https://${bare[0]}`;
    const cleaned = withProto.replace(/[),.;]+$/g, "");
    if (/^https?:\/\/591\.to\//i.test(cleaned)) return cleaned;
    if (is591ListingUrl(cleaned)) return normalize591ListingUrl(cleaned);
  }
  return null;
}

/** 任意物件字串化後抽 591 網址（給非純文字／分享卡片 webhook 用） */
export function find591UrlInUnknown(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return find591UrlInText(raw);
  try {
    return find591UrlInText(JSON.stringify(raw));
  } catch {
    return null;
  }
}

/** 591 App／分享常見文案（有連結或僅有標題線索） */
export function is591ShareText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (find591UrlInText(t) || extract591ListingId(t)) return true;
  if (/來自【?\s*591\s*(APP)?\s*】?/i.test(t)) return true;
  if (/請參考所附連結/.test(t) && /591|出租|租屋|套房|公寓|大樓/.test(t)) return true;
  return false;
}

export function resolve591IdFromUrlOrId(raw: string | null | undefined): {
  id: string | null;
  url: string | null;
} {
  const text = (raw ?? "").trim();
  if (!text) return { id: null, url: null };
  const url = is591ListingUrl(text) ? normalize591ListingUrl(text) : null;
  const id = extract591ListingId(text);
  return { id, url: url ?? (id ? `https://rent.591.com.tw/rent-detail-${id}.html` : null) };
}
