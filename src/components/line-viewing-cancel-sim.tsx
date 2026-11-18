"use client";

import { useMemo, useState } from "react";
import { LineViewingCancel } from "@/components/line-viewing-cancel";
import {
  VIEWING_CANCELLED_GUEST_TEXT,
  VIEWING_SUBMIT_ACK_TEXT,
  buildViewingConfirmedGuestText,
} from "@/lib/line-viewing-guest-copy";

type StepId = "booked" | "confirmed" | "cancelOpen" | "cancelled";

type ChatBubble =
  | { id: string; from: "guest" | "bot" | "system"; kind: "text"; text: string }
  | {
      id: string;
      from: "bot";
      kind: "manage";
      when: string;
    };

const WHEN = "2026/11/20 下午 14:00–16:00";
const LISTINGS = [
  { title: "板橋文化路兩房", address: "新北市板橋區文化路一段" },
  { title: "江子翠近捷運套房", address: "新北市板橋區縣民大道" },
];

export function LineViewingCancelSim() {
  const [step, setStep] = useState<StepId>("booked");
  const [cancelSheet, setCancelSheet] = useState(false);

  const confirmText = useMemo(
    () =>
      buildViewingConfirmedGuestText(
        WHEN,
        LISTINGS.map((item) => ({
          title: item.title,
          pageUrl: "#",
          address: item.address,
        })),
      ),
    [],
  );

  const bubbles: ChatBubble[] = useMemo(() => {
    const list: ChatBubble[] = [
      {
        id: "g1",
        from: "guest",
        kind: "text",
        text: `【找房預約】我想看以下物件，請協助確認時間。\n看屋時間：${WHEN}\n· ${LISTINGS[0].title}\n· ${LISTINGS[1].title}`,
      },
      {
        id: "b1",
        from: "bot",
        kind: "text",
        text: VIEWING_SUBMIT_ACK_TEXT,
      },
    ];
    if (step === "booked") return list;

    list.push({
      id: "b2",
      from: "bot",
      kind: "text",
      text: confirmText,
    });
    list.push({
      id: "b3",
      from: "bot",
      kind: "manage",
      when: WHEN,
    });

    if (step === "cancelled") {
      list.push({
        id: "b4",
        from: "bot",
        kind: "text",
        text: VIEWING_CANCELLED_GUEST_TEXT,
      });
      list.push({
        id: "s1",
        from: "system",
        kind: "text",
        text: "案件狀態：已取消（cancelled）",
      });
    }
    return list;
  }, [confirmText, step]);

  function reset() {
    setStep("booked");
    setCancelSheet(false);
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-[#748190] px-3 py-4 sm:px-4">
      <div className="mb-3 rounded-2xl bg-white/95 px-3 py-2.5 shadow-sm">
        <h1 className="text-sm font-bold text-[#0b2545]">約看取消 · 完整對話模擬</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          依序：客人預約 → 業務確認 → 出現取消卡片 → 開取消視窗 → 取消完成
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-[#6b7785] shadow-lg ring-1 ring-black/10">
        <header className="flex items-center gap-2 bg-[#748190] px-3 py-2.5 text-white">
          <span className="text-lg leading-none">‹</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">不動產實踐家</p>
            <p className="text-[10px] text-white/80">官方帳號（模擬）</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#748190] px-3 py-3">
          {bubbles.map((bubble) => {
            if (bubble.from === "system") {
              return (
                <p key={bubble.id} className="px-4 text-center text-[11px] text-white/90">
                  {bubble.text}
                </p>
              );
            }
            const mine = bubble.from === "guest";
            if (bubble.kind === "manage") {
              return (
                <div key={bubble.id} className="mr-10 max-w-[85%] rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-sm font-bold text-[#0b2545]">約看已安排</p>
                  <p className="mt-1 text-xs text-zinc-700">{bubble.when}</p>
                  <p className="mt-2 text-[11px] text-zinc-500">時間不方便可取消，再重新預約。</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCancelSheet(true);
                    }}
                    className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-800"
                  >
                    取消這次預約
                  </button>
                </div>
              );
            }
            return (
              <div
                key={bubble.id}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                  mine
                    ? "ml-auto bg-[#95ec69] text-zinc-900"
                    : "mr-10 bg-white text-zinc-900"
                }`}
              >
                {bubble.text}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-black/10 bg-[#eceff1] px-3 py-3">
          {step === "booked" ? (
            <button
              type="button"
              onClick={() => setStep("confirmed")}
              className="w-full rounded-xl bg-[#0b2545] px-3 py-2.5 text-sm font-semibold text-white"
            >
              下一步：業務確認時間
            </button>
          ) : null}
          {step === "confirmed" && !cancelSheet ? (
            <p className="text-center text-[11px] text-zinc-600">
              點上方白卡的「取消這次預約」看取消視窗
            </p>
          ) : null}
          {step === "cancelled" ? (
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-800"
            >
              重播模擬
            </button>
          ) : null}
          {step !== "cancelled" ? (
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-xl border border-transparent px-3 py-1.5 text-xs font-medium text-zinc-500"
            >
              重來
            </button>
          ) : null}
        </div>

        {cancelSheet ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-black/45">
            <button
              type="button"
              className="h-10 shrink-0"
              aria-label="關閉遮罩"
              onClick={() => setCancelSheet(false)}
            />
            <div className="min-h-0 flex-1 overflow-hidden rounded-t-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
                <p className="text-xs font-semibold text-zinc-500">LINE 內取消視窗（模擬）</p>
                <button
                  type="button"
                  onClick={() => setCancelSheet(false)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600"
                >
                  關閉
                </button>
              </div>
              <div className="h-[min(70dvh,560px)] overflow-y-auto">
                <LineViewingCancel
                  caseId="demo"
                  onCancelled={() => {
                    setCancelSheet(false);
                    setStep("cancelled");
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
