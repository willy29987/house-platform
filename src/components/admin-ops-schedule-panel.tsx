"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_OPS_SCHEDULE,
  SYNC_INTERVAL_OPTIONS,
  type OpsSchedule,
  type SyncIntervalHours,
} from "@/lib/ops-schedule-shared";

function formatTaipei(iso: string | null) {
  if (!iso) return "尚未執行";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export function AdminOpsSchedulePanel() {
  const [schedule, setSchedule] = useState<OpsSchedule>(DEFAULT_OPS_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ops-schedule", { credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; schedule?: OpsSchedule; message?: string };
      if (!res.ok || !json.ok || !json.schedule) {
        setStatus(json.message || "讀取排程失敗");
        return;
      }
      setSchedule(json.schedule);
      setStatus("");
    } catch {
      setStatus("讀取排程失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(patch: Partial<OpsSchedule> & { runSyncNow?: boolean; runPushNow?: boolean }) {
    setSaving(true);
    setStatus(patch.runSyncNow ? "正在立即抓取…" : patch.runPushNow ? "正在立即推播…" : "儲存中…");
    try {
      const res = await fetch("/api/admin/ops-schedule", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        schedule?: OpsSchedule;
        message?: string;
      };
      if (!res.ok || !json.ok || !json.schedule) {
        setStatus(json.message || "儲存失敗");
        return;
      }
      setSchedule(json.schedule);
      setStatus(
        patch.runSyncNow
          ? "已完成立即抓取"
          : patch.runPushNow
            ? "已完成立即推播"
            : "已儲存排程",
      );
    } catch {
      setStatus("儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">排程載入中…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">自動排程</h2>
        <p className="mt-1 text-xs text-zinc-500">
          台北時間。每小時檢查一次：到點才抓 591／推播。抓愈勤愈吃雲端執行量。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800">591 自動抓取</p>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={schedule.syncEnabled}
                disabled={saving}
                onChange={(e) => setSchedule((s) => ({ ...s, syncEnabled: e.target.checked }))}
              />
              啟用
            </label>
          </div>
          <label className="block text-xs text-zinc-500">間隔</label>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            disabled={saving || !schedule.syncEnabled}
            value={schedule.syncIntervalHours}
            onChange={(e) =>
              setSchedule((s) => ({
                ...s,
                syncIntervalHours: Number(e.target.value) as SyncIntervalHours,
              }))
            }
          >
            {SYNC_INTERVAL_OPTIONS.map((h) => (
              <option key={h} value={h}>
                每 {h} 小時
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-zinc-400">上次：{formatTaipei(schedule.lastSyncAt)}</p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ runSyncNow: true })}
            className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            立即抓一次
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800">客人彙整推播</p>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={schedule.pushEnabled}
                disabled={saving}
                onChange={(e) => setSchedule((s) => ({ ...s, pushEnabled: e.target.checked }))}
              />
              啟用
            </label>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500">時</label>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={saving || !schedule.pushEnabled}
                value={schedule.pushHour}
                onChange={(e) => setSchedule((s) => ({ ...s, pushHour: Number(e.target.value) }))}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500">分</label>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={saving || !schedule.pushEnabled}
                value={schedule.pushMinute}
                onChange={(e) =>
                  setSchedule((s) => ({
                    ...s,
                    pushMinute: Number(e.target.value) as 0 | 15 | 30 | 45,
                  }))
                }
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            每天一次｜上次：{formatTaipei(schedule.lastPushAt)}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ runPushNow: true })}
            className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            立即推播一次
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void save({
              syncEnabled: schedule.syncEnabled,
              syncIntervalHours: schedule.syncIntervalHours,
              pushEnabled: schedule.pushEnabled,
              pushHour: schedule.pushHour,
              pushMinute: schedule.pushMinute,
            })
          }
          className="rounded-lg bg-[#0b2545] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "處理中…" : "儲存排程"}
        </button>
        {status ? <p className="text-xs text-zinc-600">{status}</p> : null}
      </div>
    </div>
  );
}
