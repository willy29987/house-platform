import "server-only";

import {
  normalize591ListingUrl,
  type Listing591CheckEntry,
} from "@/lib/owner-tracking-listing-checks";

export { is591ListingUrl, normalize591ListingUrl } from "@/lib/owner-tracking-listing-checks";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

import { classify591HttpResponse } from "@/lib/listing-591-classify";

export async function check591ListingUrl(rawUrl: string): Promise<Listing591CheckEntry> {
  const url = normalize591ListingUrl(rawUrl);
  const checkedAt = new Date().toISOString();
  if (!url) {
    return { url: rawUrl.trim(), status: "error", checkedAt };
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8_000),
    });
    const body = await res.text();
    const status = classify591HttpResponse(res.status, body);
    return {
      url,
      status,
      checkedAt,
      httpStatus: res.status,
    };
  } catch {
    return { url, status: "unknown", checkedAt };
  }
}

export async function check591ListingUrlBatch(
  items: { caseId: string; url: string }[],
  opts: { concurrency?: number } = {},
): Promise<Record<string, Listing591CheckEntry>> {
  const concurrency = Math.min(Math.max(opts.concurrency ?? 4, 1), 6);
  const results: Record<string, Listing591CheckEntry> = {};
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      if (!item) continue;
      results[item.caseId] = await check591ListingUrl(item.url);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
