"use client";

import { useState } from "react";

type PreviewResult = {
  ok: boolean;
  message?: string;
  detected?: boolean;
  topics?: string[];
  listingId?: string | null;
  listingTitle?: string | null;
  source591Id?: string | null;
  attrs?: {
    petsAllowed: boolean | null;
    rentSubsidy: boolean | null;
    taxDeductible: boolean | null;
    canRegisterAddress: boolean | null;
  } | null;
  replyText?: string;
  delaySec?: { min: number; max: number };
};

const SAMPLES = [
  "這間可以養寵物嗎",
  "能申請租補嗎？",
  "報稅方便嗎",
  "可以入戶籍嗎",
  "租補跟報稅都可以嗎",
];

function attrLabel(v: boolean | null | undefined) {
  if (v === true) return "可";
  if (v === false) return "不可";
  return "未填";
}

export function LineConditionReplyTestClient() {
  const [text, setText] = useState(SAMPLES[0]);
  const [listingId, setListingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<PreviewResult | null>(null);

  async function runPreview() {
    const payload = {
      text: text.trim(),
      listingId: listingId.trim() || undefined,
    };
    if (!payload.text) {
      setStatus("請先輸入客人訊息");
      return;
    }

    setLoading(true);
    setStatus("請求中…");
    setResult(null);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch("/api/admin/line-condition-reply-preview", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const raw = await response.text();
      let data: PreviewResult;
      try {
        data = JSON.parse(raw) as PreviewResult;
      } catch {
        setResult({
          ok: false,
          message: `伺服器回了非 JSON（HTTP ${response.status}）。可能未登入或權限不足，請重新登入後台再試。`,
        });
        setStatus(`失敗 HTTP ${response.status}`);
        return;
      }

      if (!response.ok || !data.ok) {
        setResult({
          ok: false,
          message: data.message || `預覽失敗（HTTP ${response.status}）`,
        });
        setStatus(`失敗 HTTP ${response.status}`);
        return;
      }

      setResult(data);
      setStatus(data.detected ? "已偵測到條件問句" : "未偵測到條件問句（不會自動回）");
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      setResult({
        ok: false,
        message: aborted ? "請求逾時（20 秒），請再試一次" : "連線失敗，請重新整理後再試",
      });
      setStatus(aborted ? "逾時" : "連線失敗");
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((sample) => (
          <button
            key={sample}
            type="button"
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            onClick={() => setText(sample)}
          >
            {sample}
          </button>
        ))}
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-500">客人訊息</span>
        <textarea
          className="min-h-20 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-500">
          物件（後台 ID，或 591 網址／編號都行）
        </span>
        <input
          className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
          placeholder="例：/admin/listings/後面那串，或 https://rent.591.com.tw/…"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loading || !text.trim()}
          onClick={() => void runPreview()}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "預覽中…" : "預覽回覆"}
        </button>
        {status ? <span className="text-xs text-zinc-500">{status}</span> : null}
      </div>

      {result ? (
        <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {!result.ok ? (
            <p className="font-medium text-red-600">{result.message || "失敗"}</p>
          ) : (
            <>
              <p>
                偵測：{result.detected ? "有" : "無"}{" "}
                {result.topics?.length ? `（${result.topics.join("、")}）` : ""}
              </p>
              <p>
                物件：{result.listingTitle || "（對不到）"}{" "}
                {result.listingId ? (
                  <span className="text-zinc-500">{result.listingId}</span>
                ) : result.source591Id ? (
                  <span className="text-amber-700">
                    （有 591 #{result.source591Id}，但內網沒有「已上架出租」對應物件）
                  </span>
                ) : null}
              </p>
              {result.attrs ? (
                <p className="text-zinc-600">
                  屬性：寵物 {attrLabel(result.attrs.petsAllowed)}／租補{" "}
                  {attrLabel(result.attrs.rentSubsidy)}／報稅 {attrLabel(result.attrs.taxDeductible)}
                  ／入戶籍 {attrLabel(result.attrs.canRegisterAddress)}
                </p>
              ) : null}
              {result.delaySec ? (
                <p className="text-zinc-500">
                  正式延遲約 {result.delaySec.min}～{result.delaySec.max} 秒後 push
                </p>
              ) : null}
              <pre className="whitespace-pre-wrap rounded-md border border-zinc-100 bg-white p-3 text-zinc-800">
                {result.replyText || "（不會排程回覆）"}
              </pre>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
