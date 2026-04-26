"use client";

import { useMemo, useState } from "react";

type DraftStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SCHEDULED";
type Channel =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "THREADS"
  | "XIAOHONGSHU"
  | "YOUTUBE_SHORTS"
  | "LINE_OA";

type DraftItem = {
  id: string;
  title: string;
  hook: string;
  script: string;
  caption: string;
  hashtags: string[];
  sourceType: string;
  sourceUrl: string | null;
  targetChannels: Channel[];
  status: DraftStatus;
  reviewNote: string | null;
  approvedBy: string | null;
  scheduledAt: string | null;
  createdAt: string;
};

const CHANNELS: Channel[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "THREADS",
  "XIAOHONGSHU",
  "YOUTUBE_SHORTS",
  "LINE_OA",
];

export function AdminContentQueue({ initialDrafts }: { initialDrafts: DraftItem[] }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | DraftStatus>("PENDING_REVIEW");
  const [simpleMode, setSimpleMode] = useState(true);

  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlChannels, setCrawlChannels] = useState<Channel[]>(["INSTAGRAM", "FACEBOOK"]);
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleDrafts = useMemo(() => {
    if (statusFilter === "ALL") return drafts;
    return drafts.filter((d) => d.status === statusFilter);
  }, [drafts, statusFilter]);

  async function refresh() {
    const res = await fetch("/api/admin/content-drafts");
    const json = (await res.json()) as { ok: boolean; drafts: DraftItem[] };
    if (json.ok) setDrafts(json.drafts);
  }

  async function approve(id: string, sendToBuffer: boolean) {
    setLoadingId(id);
    setMessage(null);
    try {
      const scheduleAt = sendToBuffer
        ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        : undefined;
      const res = await fetch(`/api/admin/content-drafts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToBuffer, scheduleAt }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "核准失敗");
      setMessage(sendToBuffer ? "已核准並嘗試送出排程。" : "已核准（未送排程）。");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "核准失敗");
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(id: string) {
    const note = window.prompt("請輸入退回原因");
    if (!note) return;
    setLoadingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/content-drafts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "退回失敗");
      setMessage("已退回並附上原因。");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "退回失敗");
    } finally {
      setLoadingId(null);
    }
  }

  async function importFromCrawler() {
    if (!crawlUrl.trim()) return;
    setCrawlBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/content-drafts/import-crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl.trim(), targetChannels: crawlChannels }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "匯入失敗");
      setMessage("爬蟲匯入成功，已進入待審核。");
      setCrawlUrl("");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "匯入失敗");
    } finally {
      setCrawlBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">操作模式</h2>
            <p className="text-xs text-zinc-500">
              新手模式只保留必要流程：核准（不外發）/ 核准並送排程。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSimpleMode((v) => !v)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700"
          >
            {simpleMode ? "切換進階模式" : "切換新手模式"}
          </button>
        </div>
      </div>

      {!simpleMode ? (
        <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-900">爬蟲匯入（先審核再外發）</h2>
          <div className="mt-2 flex flex-col gap-2">
            <input
              value={crawlUrl}
              onChange={(e) => setCrawlUrl(e.target.value)}
              placeholder="貼上要抓取的網址（新聞、部落格、競品頁）"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => {
                const checked = crawlChannels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() =>
                      setCrawlChannels((prev) =>
                        checked ? prev.filter((x) => x !== ch) : [...prev, ch],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs ${checked ? "bg-[#0b2545] text-white" : "bg-white text-zinc-700"}`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={importFromCrawler}
              disabled={crawlBusy || !crawlUrl.trim()}
              className="w-fit rounded-lg bg-[#0b2545] px-3 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
            >
              {crawlBusy ? "匯入中…" : "匯入成待審核草稿"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">內容審核佇列</h2>
        {!simpleMode ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | DraftStatus)}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="ALL">全部</option>
            <option value="PENDING_REVIEW">待審核</option>
            <option value="APPROVED">已核准</option>
            <option value="SCHEDULED">已排程</option>
            <option value="REJECTED">已退回</option>
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING_REVIEW")}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700"
          >
            只看待審核
          </button>
        )}
      </div>

      {message ? (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 ring-1 ring-blue-200">
          {message}
        </div>
      ) : null}

      <div className="space-y-3">
        {visibleDrafts.map((d) => (
          <article key={d.id} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{d.status}</span>
              <span className="text-xs text-zinc-500">{new Date(d.createdAt).toLocaleString("zh-TW")}</span>
              <span className="text-xs text-zinc-500">來源：{d.sourceType}</span>
            </div>
            <h3 className="text-base font-semibold text-zinc-900">{d.title}</h3>
            {d.sourceUrl ? (
              <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                來源連結
              </a>
            ) : null}
            {!simpleMode ? (
              <>
                <p className="mt-2 text-sm text-zinc-700">Hook：{d.hook}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">Caption：{d.caption}</p>
                <p className="mt-1 text-xs text-zinc-500">Channels：{d.targetChannels.join(", ")}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-700 line-clamp-3">{d.caption || d.hook}</p>
            )}

            {d.status === "PENDING_REVIEW" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void approve(d.id, false)}
                  disabled={loadingId === d.id}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                >
                  核准（不外發）
                </button>
                <button
                  type="button"
                  onClick={() => void approve(d.id, true)}
                  disabled={loadingId === d.id}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
                >
                  核准並送排程（Buffer）
                </button>
                <button
                  type="button"
                  onClick={() => void reject(d.id)}
                  disabled={loadingId === d.id}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white"
                >
                  退回修改
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

