"use client";

import { useState } from "react";
import { LineGuestChatPreview } from "@/components/line-guest-chat-preview";
import type { RentalMatchListing } from "@/lib/line-rental-assistant";

const WELCOME =
  "您好～請問最近有在找房子嗎？如果有需要找房子可以點選「 開始找房 」，點選您要的需求就可以推薦您合適的房源哦！";

type CtaStyle = "quickReply" | "flexButton" | "richMenu" | "flexAndRich";

const CTA_TABS: { id: CtaStyle; label: string; blurb: string }[] = [
  {
    id: "quickReply",
    label: "1. Quick Reply",
    blurb: "輸入框上方的快速回覆鈕，點了常會先送出「開始找房」文字，再開 LIFF 或接下一則帶連結的訊息。",
  },
  {
    id: "flexButton",
    label: "2. 訊息按鈕",
    blurb:
      "用在「第一次加入」的歡迎訊息，或我們主動問「有沒有在找房」時附上的卡片按鈕；不是聊天室常駐入口。",
  },
  {
    id: "richMenu",
    label: "3. 圖文選單",
    blurb: "聊天室底部固定選單，其中一格是「開始找房」，之後隨時都能再點進來。",
  },
  {
    id: "flexAndRich",
    label: "2＋3 並用",
    blurb:
      "建議組合：首次加入／主動邀約用訊息按鈕；底部圖文選單常駐給之後還要找房的人。兩邊都開同一個 LIFF。",
  },
];

/**
 * 示意真實 LINE「開始找房」入口；點入口會開 LIFF 完整找房 UI。
 */
export function LineNativeChatPreview({
  listings,
  lineBasicId,
}: {
  listings: RentalMatchListing[];
  lineBasicId: string;
}) {
  const [cta, setCta] = useState<CtaStyle>("flexAndRich");
  const [liffOpen, setLiffOpen] = useState(false);
  const [guestSentStart, setGuestSentStart] = useState(false);

  const showFlex = cta === "flexButton" || cta === "flexAndRich";
  const showRich = cta === "richMenu" || cta === "flexAndRich";
  const showQuick = cta === "quickReply";

  function openLiff(fromQuickReply = false) {
    if (fromQuickReply) setGuestSentStart(true);
    setLiffOpen(true);
  }

  function switchCta(next: CtaStyle) {
    setCta(next);
    setLiffOpen(false);
    setGuestSentStart(false);
  }

  const tabMeta = CTA_TABS.find((item) => item.id === cta)!;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2">
      <p className="text-xs leading-relaxed text-zinc-500">
        下面是真實 LINE@ 常見入口示意。訊息按鈕與圖文選單可以一起開；點「開始找房」都進同一套{" "}
        <strong className="font-semibold text-zinc-700">LIFF 完整找房 UI</strong>。
      </p>

      <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1">
        {CTA_TABS.map((item) => {
          const on = cta === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchCta(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                on ? "bg-[#0b2545] text-white" : "text-zinc-600 hover:bg-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">{tabMeta.blurb}</p>

      <div className="relative flex h-[min(44rem,calc(100dvh-16rem))] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-[#7494c0] shadow-sm">
        <header className="flex items-center justify-between gap-2 bg-[#432e1f] px-3 py-2.5 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">租屋客服（LINE）</p>
            <p className="truncate text-[11px] text-white/70">{lineBasicId || "官方帳號"}</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          <div className="flex justify-start">
            <p className="w-fit max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900">
              {WELCOME}
            </p>
          </div>

          {showFlex ? (
            <div className="flex justify-start">
              <div className="w-[85%] max-w-[16rem] overflow-hidden rounded-2xl rounded-tl-sm bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    {cta === "flexAndRich" ? "歡迎／主動邀約訊息" : "單次訊息卡片"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">開始為你配對房源</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    給第一次加入，或我們主動詢問有沒有在找房時使用
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openLiff(false)}
                  className="w-full bg-[#06c755] py-2.5 text-sm font-bold text-white"
                >
                  開始找房
                </button>
              </div>
            </div>
          ) : null}

          {showQuick && guestSentStart ? (
            <div className="flex justify-end">
              <p className="w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-[#95ec69] px-3 py-2 text-sm text-zinc-900">
                開始找房
              </p>
            </div>
          ) : null}

          {showRich && !showFlex ? (
            <p className="px-1 text-[11px] text-white/85">↓ 點聊天室底部圖文選單的「開始找房」</p>
          ) : null}
          {showFlex && showRich ? (
            <p className="px-1 text-[11px] text-white/85">可點上方卡片按鈕，或下方圖文選單「開始找房」</p>
          ) : null}
          {showFlex && !showRich ? (
            <p className="px-1 text-[11px] text-white/85">↑ 點訊息卡片裡的綠色按鈕</p>
          ) : null}
          {showQuick && !guestSentStart ? (
            <p className="px-1 text-[11px] text-white/85">↓ 點輸入框上方的 Quick Reply</p>
          ) : null}
        </div>

        {showQuick ? (
          <div className="border-t border-black/5 bg-[#eceff3] px-2 py-2">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => openLiff(true)}
                className="shrink-0 rounded-full border border-[#06c755]/70 bg-white px-3 py-1.5 text-sm font-medium text-[#06c755]"
              >
                開始找房
              </button>
            </div>
          </div>
        ) : null}

        {showRich ? (
          <div className="border-t border-zinc-300 bg-[#1a1a1a]">
            <div className="grid grid-cols-3 gap-px bg-zinc-700">
              {(
                [
                  { label: "最新物件", action: false },
                  { label: "開始找房", action: true },
                  { label: "聯絡客服", action: false },
                ] as const
              ).map((cell) => (
                <button
                  key={cell.label}
                  type="button"
                  onClick={() => {
                    if (cell.action) openLiff(false);
                  }}
                  className={`flex aspect-[4/3] flex-col items-center justify-center px-1 ${
                    cell.action ? "bg-[#06c755] text-white" : "bg-[#2a2a2a] text-zinc-200"
                  }`}
                >
                  <span className="text-xs font-semibold">{cell.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-zinc-200 bg-[#eceff3] px-2 py-2">
            <span className="text-lg text-zinc-400" aria-hidden>
              ＋
            </span>
            <div className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-400">
              輸入訊息…
            </div>
            <span className="shrink-0 rounded-full bg-zinc-300 px-3 py-1.5 text-sm font-semibold text-white">
              傳送
            </span>
          </div>
        )}

        {liffOpen ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-black/45 p-2">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold text-white">LIFF · 找房（完整 UI）</p>
              <button
                type="button"
                onClick={() => setLiffOpen(false)}
                className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-800"
              >
                關閉
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="h-full overflow-y-auto p-2">
                <LineGuestChatPreview listings={listings} lineBasicId={lineBasicId} mode="liff-demo" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
