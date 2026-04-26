import type { ContentChannel } from "@prisma/client";

type CrawlResult = {
  title: string;
  text: string;
  sourceUrl: string;
};

export async function crawlUrl(url: string): Promise<CrawlResult> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(raw.slice(0, 300));
      const json = JSON.parse(raw) as {
        success?: boolean;
        data?: { markdown?: string; metadata?: { title?: string } };
      };
      const markdown = json.data?.markdown || "";
      return {
        sourceUrl: url,
        title: json.data?.metadata?.title || extractTitleFromMarkdown(markdown) || "未命名來源",
        text: stripMarkdown(markdown).slice(0, 10000),
      };
    } catch {
      // fallback to basic fetch below
    }
  }

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 content-bot" } });
  const html = await response.text();
  const title = extractTitleFromHtml(html) || "未命名來源";
  const text = normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).slice(0, 10000);
  return { sourceUrl: url, title, text };
}

export function buildAlgorithmNotes(channels: ContentChannel[]) {
  return channels.map((channel) => ({
    channel,
    notes: getChannelNotes(channel),
  }));
}

export function extractHashtags(text: string) {
  return Array.from(new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 12)));
}

export function buildCaptionFromSource(source: CrawlResult) {
  const lead = source.text.slice(0, 220).trim();
  return `${lead}\n\n更多細節請看來源整理，留言「想看」我再補完整分析。`;
}

export async function scheduleToBuffer(params: {
  text: string;
  channels: ContentChannel[];
  scheduledAt: Date;
}) {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    return { scheduled: [], skipped: params.channels.map((c) => ({ channel: c, reason: "未設定 BUFFER_ACCESS_TOKEN" })) };
  }

  const scheduled: Array<{ channel: ContentChannel; updateId: string }> = [];
  const skipped: Array<{ channel: ContentChannel; reason: string }> = [];

  for (const channel of params.channels) {
    const profileId = getBufferProfileId(channel);
    if (!profileId) {
      skipped.push({ channel, reason: "未設定對應 BUFFER_PROFILE_ID" });
      continue;
    }

    const payload = new URLSearchParams();
    payload.set("text", params.text);
    payload.set("profile_ids[]", profileId);
    payload.set("scheduled_at", Math.floor(params.scheduledAt.getTime() / 1000).toString());
    payload.set("now", "false");

    const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
    });
    const raw = await res.text();
    if (!res.ok) {
      skipped.push({ channel, reason: raw.slice(0, 180) });
      continue;
    }
    const json = JSON.parse(raw) as { updates?: Array<{ id?: string }> };
    const updateId = json.updates?.[0]?.id;
    if (updateId) scheduled.push({ channel, updateId });
    else skipped.push({ channel, reason: "Buffer 未回傳 update id" });
  }

  return { scheduled, skipped };
}

function getBufferProfileId(channel: ContentChannel) {
  switch (channel) {
    case "INSTAGRAM":
      return process.env.BUFFER_PROFILE_ID_INSTAGRAM;
    case "FACEBOOK":
      return process.env.BUFFER_PROFILE_ID_FACEBOOK;
    case "THREADS":
      return process.env.BUFFER_PROFILE_ID_THREADS;
    case "YOUTUBE_SHORTS":
      return process.env.BUFFER_PROFILE_ID_YOUTUBE;
    default:
      return null;
  }
}

function getChannelNotes(channel: ContentChannel) {
  switch (channel) {
    case "INSTAGRAM":
      return [
        "前 1 秒要有數字或痛點鉤子",
        "封面文字 <= 8 字，避免資訊過載",
        "內文前三行放關鍵字與 CTA",
      ];
    case "FACEBOOK":
      return [
        "主文不放外連，外連放首則留言",
        "首句要有在地關鍵字（區域 + 房型）",
        "加 1 句提問提高留言率",
      ];
    case "THREADS":
      return [
        "句子短、口語化，100 字內為佳",
        "先觀點再提問，避免廣告口吻",
        "2-3 個 hashtag 即可",
      ];
    case "XIAOHONGSHU":
      return [
        "標題含區域關鍵字與對比語（例如 1500 萬怎麼選）",
        "正文分段，首段先講結論",
        "避免硬性銷售詞，強化生活場景",
      ];
    case "YOUTUBE_SHORTS":
      return [
        "開頭 3 秒先下結論或懸念",
        "描述前 2 行放核心關鍵字",
        "結尾固定 CTA（留言/訂閱擇一）",
      ];
    case "LINE_OA":
      return [
        "標題先放利益點，不超過 18 字",
        "一則訊息只做一件事（看屋/索取清單）",
        "推播頻率控制每週 1-2 次",
      ];
    default:
      return [];
  }
}

function extractTitleFromHtml(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? normalizeText(m[1]) : "";
}

function extractTitleFromMarkdown(md: string) {
  const line = md.split("\n").find((l) => /^#\s+/.test(l.trim()));
  return line ? line.replace(/^#\s+/, "").trim() : "";
}

function stripMarkdown(md: string) {
  return normalizeText(
    md
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]+`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
      .replace(/[#>*_\-\|]/g, " "),
  );
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
