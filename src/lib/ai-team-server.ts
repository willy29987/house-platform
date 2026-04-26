import fs from "node:fs/promises";
import path from "node:path";
import { type TeamMember, getTeamMember } from "@/lib/ai-team-data";

// AI 供應商設定
// - openai: 走 OpenAI 相容 /chat/completions
// - anthropic: 走 Anthropic 原生 /v1/messages
export type AIProvider = "openai" | "anthropic";

export type AIProviderConfig = {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

const promptCache = new Map<string, string>();

function getNumberFromEnv(name: string, fallback: number, { min, max }: { min: number; max: number }) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function getIntFromEnv(name: string, fallback: number, { min, max }: { min: number; max: number }) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * 從 ai-team/ 下的 .md 檔抽出「## 提示詞」底下第一個 ``` 區塊當 system prompt。
 * 僅在 Route Handler 等 server 端呼叫。
 */
export async function loadSystemPrompt(memberId: string): Promise<string> {
  const member = getTeamMember(memberId);
  if (!member) throw new Error(`Unknown team member: ${memberId}`);

  if (promptCache.has(member.id)) return promptCache.get(member.id)!;

  const filePath = path.join(process.cwd(), "ai-team", member.file);

  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    const fallback = buildFallbackPrompt(member);
    promptCache.set(member.id, fallback);
    return fallback;
  }

  const extracted = extractPromptFromMarkdown(raw);
  const finalPrompt = extracted || buildFallbackPrompt(member);

  promptCache.set(member.id, finalPrompt);
  return finalPrompt;
}

function extractPromptFromMarkdown(raw: string): string | null {
  const headingIdx = raw.indexOf("## 提示詞");
  if (headingIdx === -1) return null;

  const after = raw.slice(headingIdx);
  const fenceOpen = after.indexOf("```");
  if (fenceOpen === -1) return null;
  const afterFence = after.slice(fenceOpen + 3);
  const firstNewline = afterFence.indexOf("\n");
  if (firstNewline === -1) return null;
  const body = afterFence.slice(firstNewline + 1);
  const closeIdx = body.indexOf("```");
  if (closeIdx === -1) return null;
  return body.slice(0, closeIdx).trim();
}

function buildFallbackPrompt(m: TeamMember): string {
  return `你是「${m.name}」(${m.title})，房地產 × 短影音團隊的一員。
職責：${m.blurb}。
請以繁體中文回答，輸出結構化、可行動的建議，避免空話。`;
}

export function getAIConfig(): AIProviderConfig | null {
  const explicit = (process.env.AI_PROVIDER || "").toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  const useAnthropic =
    explicit === "anthropic" || (explicit === "" && Boolean(anthropicKey) && !openaiKey);

  if (useAnthropic) {
    if (!anthropicKey) return null;
    // 模型 ID 以 Anthropic 官網 /v1/messages 文件為準；舊名如 claude-3-5-haiku-* 可能已停產
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      baseURL: (process.env.AI_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
      model: process.env.AI_MODEL || "claude-haiku-4-5",
    };
  }

  if (!openaiKey) return null;
  return {
    provider: "openai",
    apiKey: openaiKey,
    baseURL: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

/**
 * 單次文字完成（非串流），供協作流程在 server 端串角色討論。
 */
export async function generateText(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: ChatTurn[],
): Promise<string> {
  if (config.provider === "anthropic") {
    return generateTextAnthropic(config, systemPrompt, messages);
  }
  return generateTextOpenAI(config, systemPrompt, messages);
}

async function generateTextOpenAI(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: ChatTurn[],
): Promise<string> {
  const temperature = getNumberFromEnv("AI_TEMPERATURE", 0.35, { min: 0, max: 1.5 });
  const maxTokens = getIntFromEnv("AI_MAX_TOKENS", 700, { min: 100, max: 4000 });
  const res = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(parseProviderError(raw) || `AI 服務錯誤 (${res.status})`);
  }
  const json = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI 沒有回傳內容。");
  return content;
}

async function generateTextAnthropic(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: ChatTurn[],
): Promise<string> {
  const maxTokens = getIntFromEnv("AI_MAX_TOKENS", 900, { min: 100, max: 4000 });
  const res = await fetch(`${config.baseURL}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(parseProviderError(raw) || `Claude API 錯誤 (${res.status})`);
  }
  const json = JSON.parse(raw) as { content?: Array<{ type?: string; text?: string }> };
  const content = (json.content || [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!content) throw new Error("Claude 沒有回傳內容。");
  return content;
}

function parseProviderError(raw: string): string | null {
  try {
    const json = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return json.error?.message || json.message || null;
  } catch {
    return raw.slice(0, 500) || null;
  }
}
