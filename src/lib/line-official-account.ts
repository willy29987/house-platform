/** 客服頁預覽用。只讀網站上的官方帳號，不開啟回覆、不送訊息。 */

export type LineAccountLink = {
  basicId: string;
  addFriendUrl: string;
  displayName: string | null;
  pictureUrl: string | null;
  channelReady: boolean;
  live: boolean;
};

export async function getLineAccountLink(): Promise<LineAccountLink> {
  const addFriendUrl = process.env.NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL || process.env.NEXT_PUBLIC_LINE_OA_URL || "";
  const basicId = addFriendUrl.match(/@[\w.-]+/)?.[0] ?? "";
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? "";
  const live = process.env.LINE_ASSISTANT_LIVE === "true";
  let displayName: string | null = null;
  let pictureUrl: string | null = null;

  if (token) {
    try {
      const response = await fetch("https://api.line.me/v2/bot/info", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as { displayName?: string; pictureUrl?: string };
        displayName = data.displayName?.trim() || null;
        pictureUrl = data.pictureUrl?.trim() || null;
      }
    } catch {
      displayName = null;
    }
  }

  return {
    basicId,
    addFriendUrl,
    displayName,
    pictureUrl,
    channelReady: Boolean(token),
    live,
  };
}
