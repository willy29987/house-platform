"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TeamGroup, TeamMember } from "@/lib/ai-team-data";
import { TEAM_GROUPS } from "@/lib/ai-team-data";
import {
  type OrchestrateDepth,
  ORCHESTRATE_DEPTH_LABEL,
} from "@/lib/ai-team-orchestrate";

type Message = { role: "user" | "assistant"; content: string };

type MemberInfo = Pick<
  TeamMember,
  "id" | "code" | "name" | "title" | "group" | "emoji" | "avatarUrl" | "blurb"
>;

const STORAGE_KEY = "ai-team-sessions-v1";

type Sessions = Record<string, Message[]>;

export function AiTeamPanel({ members }: { members: MemberInfo[] }) {
  const [activeId, setActiveId] = useState<string>(members[0]?.id ?? "director");
  const [sessions, setSessions] = useState<Sessions>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // 讀取 localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSessions(JSON.parse(raw));
    } catch {}
  }, []);

  // 寫回 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  const active = useMemo(
    () => members.find((m) => m.id === activeId) || members[0],
    [activeId, members],
  );
  const messages = sessions[activeId] || [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const grouped = useMemo(() => {
    const byGroup: Record<TeamGroup, MemberInfo[]> = {
      leader: [],
      growth: [],
      content: [],
      conversion: [],
      risk: [],
      analytics: [],
    };
    for (const m of members) byGroup[m.group].push(m);
    return byGroup;
  }, [members]);

  function updateMessages(id: string, updater: (prev: Message[]) => Message[]) {
    setSessions((s) => ({ ...s, [id]: updater(s[id] || []) }));
  }

  function clearSession() {
    if (!active) return;
    if (!confirm(`清除與「${active.name}」的這段對話？`)) return;
    updateMessages(active.id, () => []);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !active) return;

    setError(null);
    setInput("");
    setSending(true);
    const newUserMsg: Message = { role: "user", content: text };
    const prior = sessions[active.id] || [];
    const nextMessages = [...prior, newUserMsg];
    updateMessages(active.id, () => nextMessages);
    updateMessages(active.id, (p) => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/admin/team/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: active.id, messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const errJson = (await res.json().catch(() => null)) as {
          message?: string;
          detail?: string;
        } | null;
        const head = errJson?.message || `請求失敗（${res.status}）`;
        const tail = errJson?.detail ? `\n${String(errJson.detail)}` : "";
        throw new Error(`${head}${tail}`.trim());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        updateMessages(active.id, (p) => {
          const copy = [...p];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { role: "assistant", content: acc };
          }
          return copy;
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知錯誤";
      setError(msg);
      updateMessages(active.id, (p) => {
        const copy = [...p];
        if (copy.length > 0 && copy[copy.length - 1].role === "assistant" && !copy[copy.length - 1].content) {
          copy.pop();
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  function toggleVoice() {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("此瀏覽器不支援語音輸入，建議使用 Chrome 或 Edge。");
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "zh-TW";
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput((prev) => {
        const base = prev.replace(/\s*\[語音中…[^\]]*\]$/, "");
        return interim ? `${base}${finalText}[語音中…${interim}]` : `${base}${finalText}`;
      });
    };
    recognition.onend = () => {
      setListening(false);
      setInput((prev) => prev.replace(/\s*\[語音中…[^\]]*\]$/, ""));
    };
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  const quickActions = useMemo(() => getQuickActions(active?.id), [active?.id]);
  const isDirector = active?.id === "director";
  const [orchestrateDepth, setOrchestrateDepth] = useState<OrchestrateDepth>("quick");
  const [allowUpgradeDepth, setAllowUpgradeDepth] = useState(false);

  async function orchestrateByDirector() {
    const goal = input.trim();
    if (!goal || sending || !active || active.id !== "director") return;

    setError(null);
    setInput("");
    setSending(true);

    const dMeta = ORCHESTRATE_DEPTH_LABEL[orchestrateDepth];
    const userMsg: Message = {
      role: "user",
      content: `【協作深度】${dMeta.label}（${dMeta.count} 位）\n【公司目標】\n${goal}`,
    };
    const prior = sessions[active.id] || [];
    updateMessages(active.id, () => [...prior, userMsg]);
    updateMessages(active.id, (p) => [
      ...p,
      {
        role: "assistant",
        content: `總監正以「${dMeta.label}」深度召集團隊協作中（約 ${dMeta.count} 位）…`,
      },
    ]);

    try {
      const res = await fetch("/api/admin/team/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, depth: orchestrateDepth, allowUpgrade: allowUpgradeDepth }),
      });
      const payload = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            plan?: string;
            depth?: OrchestrateDepth;
            discussions?: Array<{ name: string; content: string }>;
            message?: string;
          }
        | null;

      if (!res.ok || !payload?.ok || !payload.plan) {
        throw new Error(payload?.message || `請求失敗（${res.status}）`);
      }

      const discussionBrief = (payload.discussions || [])
        .map((d) => `- ${d.name}`)
        .join("\n");
      const usedDepth = payload.depth ?? orchestrateDepth;
      const usedMeta = ORCHESTRATE_DEPTH_LABEL[usedDepth];
      const output = `## 總監自動協作結果\n\n**協作深度**：${usedMeta.label} — ${usedMeta.hint}\n\n**已召集**：\n${discussionBrief || "- 團隊成員"}\n\n---\n\n${payload.plan}`;

      updateMessages(active.id, (p) => {
        const copy = [...p];
        copy[copy.length - 1] = { role: "assistant", content: output };
        return copy;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知錯誤";
      setError(msg);
      updateMessages(active.id, (p) => {
        const copy = [...p];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "總監協作啟動失敗，請稍後再試或檢查 API 設定。",
        };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[560px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
      {/* 左側：成員列表 */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
        <div className="border-b border-zinc-200 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">AI 團隊</p>
          <p className="text-sm font-semibold text-zinc-900">共 {members.length} 位成員</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {(Object.keys(TEAM_GROUPS) as TeamGroup[]).map((g) => {
            const list = grouped[g];
            if (!list.length) return null;
            const meta = TEAM_GROUPS[g];
            return (
              <div key={g} className="mb-3">
                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {meta.label}
                </div>
                {list.map((m) => {
                  const isActive = m.id === activeId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveId(m.id)}
                      className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition ${
                        isActive
                          ? "bg-[#0b2545] text-white shadow"
                          : "hover:bg-white hover:shadow-sm"
                      }`}
                    >
                      <AvatarBadge emoji={m.emoji} avatarUrl={m.avatarUrl} size="md" />
                      <span className="flex-1">
                        <span className={`block text-sm font-semibold ${isActive ? "" : "text-zinc-900"}`}>
                          {m.code} · {m.name}
                        </span>
                        <span className={`block truncate text-[11px] ${isActive ? "text-zinc-200" : "text-zinc-500"}`}>
                          {m.blurb}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 右側：聊天區 */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* 標題 */}
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <AvatarBadge emoji={active?.emoji || "🤖"} avatarUrl={active?.avatarUrl} size="lg" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {active?.code} · {active?.name}
              </p>
              <p className="text-[11px] text-zinc-500">{active?.title} — {active?.blurb}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSession}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              清除對話
            </button>
          </div>
        </header>

        {/* 訊息 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-5">
          {messages.length === 0 ? (
            <EmptyState member={active} quickActions={quickActions} onPick={(t) => setInput(t)} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  m={m}
                  emoji={active?.emoji || "🤖"}
                  avatarUrl={active?.avatarUrl}
                />
              ))}
              {sending && messages[messages.length - 1]?.role === "user" ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                  正在思考…
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 輸入區 */}
        <div className="border-t border-zinc-200 bg-white px-6 py-3">
          {error ? (
            <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          {quickActions.length > 0 && messages.length === 0 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {quickActions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setInput(q)}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}

          {isDirector ? (
            <div className="mb-2 flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">協作深度</span>
                <select
                  value={orchestrateDepth}
                  onChange={(e) => setOrchestrateDepth(e.target.value as OrchestrateDepth)}
                  disabled={sending}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800"
                >
                  {(allowUpgradeDepth ? (["quick", "standard", "full"] as const) : (["quick"] as const)).map((d) => (
                    <option key={d} value={d}>
                      {ORCHESTRATE_DEPTH_LABEL[d].label}（{ORCHESTRATE_DEPTH_LABEL[d].count} 位）— {ORCHESTRATE_DEPTH_LABEL[d].hint}
                    </option>
                  ))}
                </select>
                <label className="ml-1 flex items-center gap-1 text-[11px] text-zinc-600">
                  <input
                    type="checkbox"
                    checked={allowUpgradeDepth}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setAllowUpgradeDepth(next);
                      if (!next) setOrchestrateDepth("quick");
                    }}
                    disabled={sending}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-emerald-600"
                  />
                  進階（較花錢）
                </label>
              </div>
              <p className="text-[11px] text-zinc-500">
                超省錢模式：預設強制快速；勾選「進階」後才會放行標準/完整
              </p>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`跟 ${active?.name} 說什麼？（Enter 送出，Shift+Enter 換行）`}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#0b2545] focus:ring-2 focus:ring-[#0b2545]/20"
            />
            <button
              type="button"
              onClick={toggleVoice}
              className={`rounded-xl px-3 py-2 text-sm font-medium ring-1 transition ${
                listening
                  ? "bg-rose-500 text-white ring-rose-500"
                  : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
              }`}
              title="語音輸入"
            >
              {listening ? "● 錄音中" : "🎤 語音"}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded-xl bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {sending ? "送出中…" : "送出"}
            </button>
            {isDirector ? (
              <button
                type="button"
                onClick={orchestrateByDirector}
                disabled={sending || !input.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                title="由總監自動召集多角色協作"
              >
                {sending ? "協作中…" : "⚡ 一鍵協作"}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            對話儲存在本機瀏覽器 · 切換成員會保留各自的對話紀錄
          </p>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ m, emoji, avatarUrl }: { m: Message; emoji: string; avatarUrl?: string }) {
  const isUser = m.role === "user";
  const displayContent = isUser ? m.content : normalizeAssistantText(m.content);
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? <AvatarBadge emoji={emoji} avatarUrl={avatarUrl} size="sm" /> : null}
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-[#0b2545] text-white"
            : "bg-white text-zinc-900 ring-1 ring-zinc-200"
        }`}
      >
        {displayContent || <span className="text-zinc-400">…</span>}
      </div>
      {isUser ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0b2545] text-sm font-semibold text-white">
          我
        </div>
      ) : null}
    </div>
  );
}

function normalizeAssistantText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*\*/g, "");
}

function EmptyState({
  member,
  quickActions,
  onPick,
}: {
  member: MemberInfo | undefined;
  quickActions: string[];
  onPick: (t: string) => void;
}) {
  if (!member) return null;
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <AvatarBadge emoji={member.emoji} avatarUrl={member.avatarUrl} size="xl" />
      <div>
        <p className="text-lg font-semibold text-zinc-900">
          跟「{member.name}」開始對話
        </p>
        <p className="mt-1 text-sm text-zinc-500">{member.title} — {member.blurb}</p>
      </div>
      {quickActions.length > 0 ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {quickActions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AvatarBadge({
  emoji,
  avatarUrl,
  size,
}: {
  emoji: string;
  avatarUrl?: string;
  size: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClass =
    size === "sm"
      ? "h-8 w-8 text-lg"
      : size === "md"
        ? "h-7 w-7 text-base"
        : size === "lg"
          ? "h-10 w-10 text-2xl"
          : "h-16 w-16 text-5xl";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="avatar"
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-zinc-200`}
      />
    );
  }

  return (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200`}>
      {emoji}
    </div>
  );
}

function getQuickActions(id?: string): string[] {
  if (!id) return [];
  const map: Record<string, string[]> = {
    director: [
      "我這個月要 30 組有效看屋名單，主打林口三房，請排本週工單。",
      "上週數據出來了：曝光 12 萬、私訊 38、預約 6。請給我下週方向。",
      "幫我決定這個物件該推哪個題材（痛點/比較/生活）。",
    ],
    "marketing-strategist": [
      "幫我設計林口三房首購族的完整行銷漏斗。",
      "主打「1500 萬內換屋族」的 4 週活動路線圖。",
    ],
    "paid-media": [
      "預算每天 2000 元，目標 CPL 300 元，幫我開 Meta 投放架構。",
      "這支影片 CTR 1.8%、CPL 450，我該放大還是優化？",
    ],
    seo: [
      "幫我規劃「林口 三房」的關鍵字地圖。",
      "Google 商家本月該發哪 4 則貼文？",
    ],
    scriptwriter: [
      "物件：林口三房 1800 萬，主打學區。給我 3 種角度腳本。",
      "幫我寫 30 秒「看屋避雷」痛點式腳本。",
    ],
    "director-video": [
      "把這份腳本拆成拍攝清單與 B-roll 清單。",
      "幫我設計這支影片的字幕風格與封面指示。",
    ],
    "social-editor": [
      "把這支短影音改寫成 IG / FB / Threads / 小紅書 / LINE 版本。",
      "幫我排本週五平台的發文排程。",
    ],
    "property-expert": [
      "地址：林口文化一路，坪數 32，開價 1800 萬，給我物件一頁式內容包。",
      "這間的隱藏優勢和需坦白的缺點分別是什麼？",
    ],
    "dm-closer": [
      "客戶私訊「這間多少錢」，幫我擬回覆與分級。",
      "對方說「我再考慮看看」，我該怎麼接？",
    ],
    crm: [
      "我有 120 組 B 級名單，幫我排本月分眾推播。",
      "沉睡 90 天的名單怎麼喚醒？",
    ],
    legal: [
      "幫我審這段文案：「保證增值，第一學區，最後 3 戶」。",
      "預售屋廣告常見的違規用字有哪些？",
    ],
    pr: [
      "Google 收到一則 1 星負評：「帶看很隨便」，幫我擬回覆。",
      "IG 留言有人指控我們誇大坪數，如何回應？",
    ],
    analyst: [
      "本週數據：曝光 12 萬、互動率 3.2%、私訊 38、預約 6、成交 0。幫我出週報。",
      "為什麼我的完播率只有 35%？可能原因？",
    ],
    "maintenance-bot": [
      "住戶回報浴室天花板滲水，請幫我做緊急程度分級與第一時間回覆模板。",
      "電梯異常停機 2 小時，幫我整理派工流程、公告文案與追蹤清單。",
    ],
  };
  return map[id] || [];
}
