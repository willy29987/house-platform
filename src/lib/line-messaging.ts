/** LINE Messaging API 推播／回覆（僅在 live + token 就緒時真送）。 */

function lineToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? "";
}

function lineLive() {
  return process.env.LINE_ASSISTANT_LIVE === "true";
}

export type LinePostbackAction = {
  type: "postback";
  label: string;
  data: string;
  displayText?: string;
};

export type LineUriAction = {
  type: "uri";
  label: string;
  uri: string;
};

export type LineMessageAction = LineUriAction | LinePostbackAction | { type: "message"; label: string; text: string };

export type LineMessage =
  | {
      type: "text";
      text: string;
      quickReply?: {
        items: Array<{ type: "action"; action: LineMessageAction }>;
      };
    }
  | {
      type: "template";
      altText: string;
      template:
        | {
            type: "buttons";
            text: string;
            title?: string;
            actions: Array<LineUriAction | LinePostbackAction>;
          }
        | {
            type: "confirm";
            text: string;
            actions: [LinePostbackAction | LineUriAction, LinePostbackAction | LineUriAction];
          };
      quickReply?: {
        items: Array<{ type: "action"; action: LineMessageAction }>;
      };
    };

export async function pushLineTextMessage(lineUserId: string, text: string) {
  return pushLineMessages(lineUserId, [{ type: "text", text }]);
}

export async function pushLineMessages(lineUserId: string, messages: LineMessage[]) {
  const token = lineToken();
  if (!token || !lineLive() || !lineUserId || !messages.length) {
    return { sent: false as const, reason: "not_live_or_missing_token" as const };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false as const, reason: "api_error" as const, status: response.status, body };
  }
  return { sent: true as const };
}

/** Webhook 用 replyToken 回覆（不需 live 旗標也可在測試時送，仍需 token） */
export async function replyLineMessages(replyToken: string, messages: LineMessage[]) {
  const token = lineToken();
  if (!token || !replyToken || !messages.length) {
    return { sent: false as const, reason: "missing_token_or_reply" as const };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false as const, reason: "api_error" as const, status: response.status, body };
  }
  return { sent: true as const };
}

export function buildPublicBaseUrl() {
  const fromLine = process.env.LINE_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "";
  if (fromLine) return fromLine;
  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  return fromSite;
}

export function buildLiffRentAssistantUrl(query?: Record<string, string>) {
  const liffId =
    process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "2012308800-rDFp5dsT";
  const qs = query
    ? `?${Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")}`
    : "";
  if (liffId) return `https://liff.line.me/${liffId}${qs}`;
  const base = buildPublicBaseUrl();
  const path = `/liff/rent-assistant${qs}`;
  return base ? `${base}${path}` : path;
}

export function buildAgentRescheduleUrl(caseId: string) {
  const base = buildPublicBaseUrl();
  const path = `/line/agent-reschedule?caseId=${encodeURIComponent(caseId)}`;
  return base ? `${base}${path}` : path;
}

/** Confirm 文案上限約 240 字元 */
export function truncateLineTemplateText(text: string, max = 220): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
