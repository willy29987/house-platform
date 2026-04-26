import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { getTeamMember } from "@/lib/ai-team-data";
import { type AIProviderConfig, getAIConfig, loadSystemPrompt } from "@/lib/ai-team-server";

const chatSchema = z.object({
  memberId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
});

type ChatMessage = { role: "user" | "assistant"; content: string };

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

function trimMessages(messages: ChatMessage[]): ChatMessage[] {
  const maxTurns = getIntFromEnv("AI_CHAT_CONTEXT_TURNS", 10, { min: 2, max: 60 });
  return messages.slice(-maxTurns);
}

export async function POST(request: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = await request.json();
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "參數錯誤" }, { status: 400 });
  }

  const member = getTeamMember(parsed.data.memberId);
  if (!member) {
    return NextResponse.json({ ok: false, message: "找不到該成員" }, { status: 404 });
  }

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "尚未設定 AI 金鑰。請在 .env 設定 AI_API_KEY（OpenAI 相容）或 ANTHROPIC_API_KEY（Claude）。",
      },
      { status: 500 },
    );
  }

  const systemPrompt = await loadSystemPrompt(member.id);
  const messages = trimMessages(parsed.data.messages);

  try {
    if (config.provider === "anthropic") {
      return await streamAnthropic(config, systemPrompt, messages);
    }
    return await streamOpenAI(config, systemPrompt, messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知錯誤";
    return NextResponse.json({ ok: false, message: msg }, { status: 502 });
  }
}

/* ---------------- OpenAI 相容 ---------------- */

async function streamOpenAI(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[],
) {
  const temperature = getNumberFromEnv("AI_TEMPERATURE", 0.35, { min: 0, max: 1.5 });
  const maxTokens = getIntFromEnv("AI_MAX_TOKENS", 700, { min: 100, max: 4000 });
  const upstream = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    const openaiErr = parseOpenAICompatErrorJson(errText);
    return NextResponse.json(
      {
        ok: false,
        message: openaiErr.message || `AI 服務錯誤 (${upstream.status})`,
        detail: errText.slice(0, 800),
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";
          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ---------------- Anthropic 原生 ---------------- */

async function streamAnthropic(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[],
) {
  const maxTokens = getIntFromEnv("AI_MAX_TOKENS", 900, { min: 100, max: 4000 });
  const upstream = await fetch(`${config.baseURL}/v1/messages`, {
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
      stream: true,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    const parsed = parseAnthropicErrorJson(errText);
    return NextResponse.json(
      {
        ok: false,
        message: parsed.message || `Claude API 錯誤 (${upstream.status})`,
        detail: (parsed.hint || errText).slice(0, 1000),
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";
            for (const line of parts) {
            const trimmed = line.replace(/\r$/, "").trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              if (json.type === "content_block_delta") {
                const d = json.delta;
                if (d?.type === "text_delta" && typeof d.text === "string" && d.text.length > 0) {
                  controller.enqueue(encoder.encode(d.text));
                } else if (typeof d?.text === "string" && d.text.length > 0) {
                  // 相容舊欄位
                  controller.enqueue(encoder.encode(d.text));
                }
              } else if (json.type === "message_stop") {
                controller.close();
                return;
              } else if (json.type === "error") {
                controller.error(
                  new Error(json.error?.message || "Anthropic stream error"),
                );
                return;
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function parseAnthropicErrorJson(raw: string): { message?: string; hint?: string } {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    const msg = j.error?.message ?? j.message;
    let hint = raw;
    if (msg && /model|not_found|invalid/i.test(msg)) {
      hint = `${msg}

建議：到 Anthropic 文件查目前可用的 model 名稱，並在 .env 設定 AI_MODEL（例：claude-haiku-4-5 或 claude-sonnet-4-5）。`;
    }
    return { message: msg, hint };
  } catch {
    return { message: undefined, hint: raw };
  }
}

function parseOpenAICompatErrorJson(raw: string): { message?: string } {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return { message: j.error?.message ?? j.message };
  } catch {
    return {};
  }
}
