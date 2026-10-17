"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatOwnerCaseAddress,
  loadOwnerTrackingStore,
  OWNER_TRACKING_STATUS_OPTIONS,
  statusBadgeClass,
  emptyOwnerTrackingStore,
  type OwnerCasePreview,
  type OwnerFollowUpPreview,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import {
  buildOwnerTrackingListRows,
  listCommunityCell,
} from "@/lib/owner-tracking-list-query";
import { PROPERTY_TYPE_OPTIONS, propertyTypeLabel } from "@/lib/property-type-label";
import {
  buildOwnerTrackingWorkbook,
  downloadOwnerTrackingExcel,
} from "@/lib/owner-tracking-excel-export";

type Props = {
  currentUsername: string;
  isSuperAdmin?: boolean;
};

/** 表頭與資料列共用，避免巢狀 grid 錯位 */
const LIST_ROW_GRID =
  "sm:grid sm:grid-cols-[minmax(0,4fr)_6rem_8.5rem_6.5rem_7rem_minmax(0,1fr)_2.25rem_5.75rem_3.25rem_2.75rem] sm:items-center sm:gap-x-2";

function formatListWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const md = d.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
  const hm = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${md} ${hm}`;
}

export function OwnerTrackingList({ currentUsername, isSuperAdmin = false }: Props) {
  const [store, setStore] = useState<OwnerTrackingStore>(emptyOwnerTrackingStore);
  const [hydrated, setHydrated] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const assigneeOptions = useMemo(() => {
    const names = new Set(
      store.cases.map((c) => c.assignee.trim()).filter((name) => name && name !== "—"),
    );
    return Array.from(names).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [store.cases]);

  useEffect(() => {
    setStore(loadOwnerTrackingStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => setStore(loadOwnerTrackingStore());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hydrated]);

  const rows = useMemo(
    () =>
      buildOwnerTrackingListRows(store, {
        keyword,
        statusFilter,
        propertyTypeFilter,
        assigneeFilter,
      }),
    [store, keyword, statusFilter, propertyTypeFilter, assigneeFilter],
  );

  async function onExportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const buffer = await buildOwnerTrackingWorkbook(store, rows);
      downloadOwnerTrackingExcel(buffer);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "匯出失敗");
    } finally {
      setExporting(false);
    }
  }

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">載入中…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-600">屋主開發／委託追蹤</p>
          <h1 className="text-2xl font-bold text-zinc-900">屋主追蹤</h1>
          <p className="mt-1 text-xs text-zinc-500">列表看最新狀態，進入案件後可多次送出追蹤並形成時間軸。</p>
        </div>
        {isSuperAdmin ? (
          <div className="w-full sm:w-auto">
            <button
              type="button"
              onClick={() => void onExportExcel()}
              disabled={exporting || rows.length === 0}
              className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#107c41] px-4 text-sm font-semibold text-white transition hover:bg-[#0c5f33] disabled:opacity-60 sm:w-auto"
            >
              {exporting ? "產生中…" : "匯出 Excel"}
            </button>
            {exportError ? <p className="mt-1 text-xs text-rose-600 sm:text-right">{exportError}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-zinc-600">搜尋</span>
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="姓名、電話、地址、物件"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block min-w-[10rem]">
          <span className="mb-1 block text-xs font-medium text-zinc-600">目前狀態</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="ALL">全部</option>
            {OWNER_TRACKING_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[10rem]">
          <span className="mb-1 block text-xs font-medium text-zinc-600">物件類別</span>
          <select
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="ALL">全部</option>
            {PROPERTY_TYPE_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {propertyTypeLabel(code)}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[10rem]">
          <span className="mb-1 block text-xs font-medium text-zinc-600">負責人</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="ALL">全部</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name === currentUsername ? `${name}（我）` : name}
              </option>
            ))}
          </select>
        </label>
        <Link
          href="/admin/owner-tracking/new"
          className="inline-flex h-[42px] w-full items-center justify-center rounded-lg bg-[#0b2545] px-4 text-sm font-semibold text-white hover:bg-[#1e3a8a] sm:w-auto"
        >
          ＋ 新增案件
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="min-w-[62rem]">
        <div
          className={`hidden border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-500 ${LIST_ROW_GRID}`}
        >
          <span className="min-w-0 truncate">地址</span>
          <span className="min-w-0 truncate">社區</span>
          <span className="min-w-0 truncate">屋主</span>
          <span className="min-w-0 truncate">網址</span>
          <span className="min-w-0 truncate">目前狀態</span>
          <span className="min-w-0 truncate">上次備註</span>
          <span className="min-w-0 text-center">電訪</span>
          <span className="min-w-0 leading-snug tabular-nums">
            建立時間
            <br />
            上次追蹤
          </span>
          <span className="min-w-0 truncate text-center">負責人</span>
          <span className="text-center">操作</span>
        </div>
        <ul className="divide-y divide-zinc-100">
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">
              {store.cases.length === 0 ? "尚無案件，請按「新增案件」建立" : "沒有符合條件的案件"}
            </li>
          ) : (
            rows.map(({ case: c, last, contactCount }) => (
              <CaseRow key={c.id} item={c} last={last} contactCount={contactCount} />
            ))
          )}
        </ul>
        </div>
      </div>
    </div>
  );
}

function normalizeListingUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  return t.startsWith("http") ? t : `https://${t}`;
}

function formatListUrl(url: string): string {
  const t = url.trim();
  if (!t) return "—";
  try {
    const href = normalizeListingUrl(t)!;
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname;
    const short = `${host}${path}`;
    return short.length > 28 ? `${short.slice(0, 26)}…` : short;
  } catch {
    return t.length > 28 ? `${t.slice(0, 26)}…` : t;
  }
}

function CaseRow({
  item,
  last,
  contactCount,
}: {
  item: OwnerCasePreview;
  last: OwnerFollowUpPreview | null;
  contactCount: number;
}) {
  const urlHref = normalizeListingUrl(item.listingUrl);
  const urlLabel = formatListUrl(item.listingUrl);

  return (
    <li className="relative transition hover:bg-zinc-50">
      <Link
        href={`/admin/owner-tracking/${item.id}`}
        className="absolute inset-0 z-0"
        aria-label={`查看案件：${item.address || item.ownerName}`}
      />
      <div className={`pointer-events-none relative z-10 px-4 py-2.5 text-sm ${LIST_ROW_GRID}`}>
        <p
          className="min-w-0 truncate text-sm font-medium leading-snug text-zinc-900"
          title={formatOwnerCaseAddress(item)}
        >
          {formatOwnerCaseAddress(item) || "—"}
        </p>
        <p className="min-w-0 truncate text-sm font-semibold leading-snug text-zinc-800">
          {listCommunityCell(item)}
        </p>
        <div className="min-w-0 overflow-hidden">
          <p className="truncate font-semibold text-zinc-900">{item.ownerName || "—"}</p>
          <p className="mt-0.5 truncate text-xs tabular-nums text-zinc-500">{item.phone || "—"}</p>
        </div>

        <div className="min-w-0 overflow-hidden">
          {urlHref ? (
            <a
              href={urlHref}
              target="_blank"
              rel="noopener noreferrer"
              title={item.listingUrl.trim()}
              className="pointer-events-auto relative z-20 block truncate text-xs text-[#1e3a8a] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {urlLabel}
            </a>
          ) : (
            <span className="pointer-events-none text-xs text-zinc-300">—</span>
          )}
        </div>

        <div className="min-w-0 overflow-hidden">
          {last ? (
            <span
              className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:text-xs ${statusBadgeClass(last.status)}`}
            >
              {last.status}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">尚未追蹤</span>
          )}
        </div>

        <p className="min-w-0 truncate text-xs text-zinc-600" title={last?.note?.trim() || undefined}>
          {last?.note?.trim() ? last.note.trim() : "—"}
        </p>

        <p className="min-w-0 text-center text-xs tabular-nums text-zinc-600">{contactCount}</p>

        <div className="min-w-0 space-y-0.5 text-[11px] leading-tight tabular-nums text-zinc-600 sm:text-xs">
          <p className="truncate" title={formatListWhen(item.createdAt)}>
            {formatListWhen(item.createdAt)}
          </p>
          <p
            className={`truncate ${last ? "text-zinc-700" : "text-zinc-400"}`}
            title={last ? formatListWhen(last.createdAt) : undefined}
          >
            {last ? formatListWhen(last.createdAt) : "—"}
          </p>
        </div>

        <p className="min-w-0 truncate text-center text-zinc-600">{item.assignee}</p>

        <div className="min-w-0 text-center">
          <Link
            href={`/admin/owner-tracking/${item.id}/edit`}
            className="pointer-events-auto relative z-20 text-xs font-semibold text-[#1e3a8a] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            修改
          </Link>
        </div>
      </div>
    </li>
  );
}
