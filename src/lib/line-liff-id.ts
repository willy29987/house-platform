/** LIFF ID 會出現在前端，屬公開設定。可用環境變數覆寫。 */
export const LINE_LIFF_RENT_ASSISTANT_ID =
  process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "2012308800-9xNMWz5n";

/** 從 LIFF 網址或 liff.state 取出 Messaging API 的 uid。 */
export function messagingUidFromSearch(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const direct = params.get("uid")?.trim();
  if (direct) return direct;
  const state = params.get("liff.state");
  if (!state) return null;
  let decoded = state;
  try {
    decoded = decodeURIComponent(state);
  } catch {
    decoded = state;
  }
  const query = decoded.includes("?")
    ? decoded.slice(decoded.indexOf("?") + 1)
    : decoded.replace(/^\?/, "");
  return new URLSearchParams(query).get("uid")?.trim() || null;
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
