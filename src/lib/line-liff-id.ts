/** LIFF ID 會出現在前端，屬公開設定。可用環境變數覆寫。 */
export const LINE_LIFF_RENT_ASSISTANT_ID =
  process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "2012308800-9xNMWz5n";

export type LiffBootstrapHint = {
  mode: "criteria" | "book" | "similar";
  listingIds: string[];
};

function listingIdsFromParam(raw: string | string[] | undefined) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [
    ...new Set(
      list
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function truthyParam(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/** 只從網址判斷要先秀哪種殼（不打 DB） */
export function resolveLiffBootstrapHint(input: {
  listingId?: string | string[];
  similar?: string | string[];
  "liff.state"?: string;
}): LiffBootstrapHint {
  const stateParams = liffStateParams(input["liff.state"]);
  const listingIds = listingIdsFromParam(
    input.listingId ??
      (stateParams.getAll("listingId").length ? stateParams.getAll("listingId") : undefined),
  );
  const similarMode = truthyParam(input.similar ?? stateParams.get("similar") ?? undefined);
  if (similarMode) return { mode: "similar", listingIds };
  if (listingIds.length) return { mode: "book", listingIds };
  return { mode: "criteria", listingIds: [] };
}

/** LIFF 第一次開啟時，原本的 query 會被包在 liff.state 裡。 */
export function liffStateParams(state: string | null | undefined): URLSearchParams {
  if (!state) return new URLSearchParams();
  let decoded = state;
  try {
    decoded = decodeURIComponent(state);
  } catch {
    decoded = state;
  }
  const query = decoded.includes("?")
    ? decoded.slice(decoded.indexOf("?") + 1)
    : decoded.replace(/^\?/, "");
  return new URLSearchParams(query);
}

/** 從 LIFF 網址或 liff.state 取出 Messaging API 的 uid。 */
export function messagingUidFromSearch(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const direct = params.get("uid")?.trim();
  if (direct) return direct;
  return liffStateParams(params.get("liff.state")).get("uid")?.trim() || null;
}

/** 瀏覽器裡讀 uid，並記住，避免 LIFF 把參數藏進 liff.state 後遺失。 */
export function readClientMessagingUid(fallback?: string | null): string | null {
  if (typeof window === "undefined") return fallback?.trim() || null;
  try {
    const fromSearch = messagingUidFromSearch(window.location.search);
    const fromStore = window.sessionStorage.getItem("line_messaging_uid")?.trim() || null;
    const uid = fromSearch || fallback?.trim() || fromStore || null;
    if (uid) window.sessionStorage.setItem("line_messaging_uid", uid);
    return uid;
  } catch {
    return fallback?.trim() || null;
  }
}
