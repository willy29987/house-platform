"use client";

import { useEffect, useState } from "react";

type AgentInfo = {
  hasToken: boolean;
  tokenHint: string | null;
  lastHeartbeatAt: string | null;
  agentLabel: string | null;
  createdAt?: string | null;
};

type ExpiringRow = {
  id: string;
  title: string;
  source591Id?: string | null;
  source591ExpiresAt?: string | null;
  daysLeft: number | null;
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "尚未";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export function Admin591SyncPanel() {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [queued, setQueued] = useState(0);
  const [running, setRunning] = useState(0);
  const [expiring, setExpiring] = useState<ExpiringRow[]>([]);
  const [expiryWarnDays, setExpiryWarnDays] = useState(7);
  const [status, setStatus] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/591-sync", { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setStatus(json.message || "讀取失敗");
      return;
    }
    setAgent(json.agent);
    setQueued(json.queued ?? 0);
    setRunning(json.running ?? 0);
    setExpiring(Array.isArray(json.expiring) ? json.expiring : []);
    if (typeof json.expiryWarnDays === "number") setExpiryWarnDays(json.expiryWarnDays);
    setStatus("");
  }

  useEffect(() => {
    void load();
  }, []);

  async function rotate() {
    if (!window.confirm("產生新 Token 會讓舊的本機 Agent 立刻失效，確定？")) return;
    setLoading(true);
    setNewToken(null);
    try {
      const res = await fetch("/api/admin/591-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate_token", agentLabel: "office-agent" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus(json.message || "產生失敗");
        return;
      }
      setNewToken(json.token);
      setStatus(json.message || "已產生");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function scanExpiry() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/591-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan_expiry", force: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus(json.message || "排程失敗");
        return;
      }
      setStatus(json.message || `已排程 ${json.enqueued ?? 0} 筆`);
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">591 本機連動</h2>
        <p className="mt-1 text-xs text-zinc-500">
          本機 Agent 會抓 591 廣告到期日；後台首頁顯示「即將到期」提醒。Agent 約每 6 小時自動掃一批。
        </p>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <p className="text-[11px] text-zinc-500">Agent Token</p>
          <p className="font-medium">{agent?.hasToken ? agent.tokenHint || "已設定" : "尚未產生"}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <p className="text-[11px] text-zinc-500">上次心跳</p>
          <p className="font-medium">{fmt(agent?.lastHeartbeatAt)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <p className="text-[11px] text-zinc-500">佇列／即將到期</p>
          <p className="font-medium">
            等待 {queued}／執行中 {running}／提醒 {expiring.length}
          </p>
        </div>
      </div>
      {expiring.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs text-rose-950">
          {expiring.slice(0, 12).map((row) => (
            <li key={row.id} className="flex flex-wrap gap-x-2">
              <span className="font-semibold">
                {row.daysLeft == null
                  ? "—"
                  : row.daysLeft < 0
                    ? `過期 ${Math.abs(row.daysLeft)} 天`
                    : row.daysLeft === 0
                      ? "今日到期"
                      : `剩 ${row.daysLeft} 天`}
              </span>
              <span className="truncate">{row.title}</span>
              {row.source591Id ? <span className="text-rose-700/70">#{row.source591Id}</span> : null}
            </li>
          ))}
          <li className="text-[10px] text-rose-800/70">提醒視窗：{expiryWarnDays} 天內（含已過期）</li>
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">目前沒有 {expiryWarnDays} 天內到期的 591 廣告（需先掃描到期日）。</p>
      )}
      {newToken ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-semibold">請立刻複製到本機 apps/591-agent/.env</p>
          <code className="mt-1 block break-all select-all">{newToken}</code>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void scanExpiry()}
          className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          {loading ? "處理中…" : "掃描全部到期日"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void rotate()}
          className="rounded-lg bg-[#0b2545] px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          {agent?.hasToken ? "重新產生 Token" : "產生 Agent Token"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
        >
          重新整理
        </button>
      </div>
      {status ? <p className="text-xs text-zinc-600">{status}</p> : null}
      <p className="text-[11px] text-zinc-400">
        本機：cd apps/591-agent → npm install → npm run login → npm start（詳見該目錄 README）
      </p>
    </div>
  );
}
