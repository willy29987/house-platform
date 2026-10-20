"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatOwnerCaseAddress,
  loadOwnerTrackingStoreLocal,
  persistOwnerTrackingStoreLocal,
  OWNER_TRACKING_STATUS_OPTIONS,
  statusBadgeClass,
  deleteOwnerCase,
  emptyOwnerTrackingStore,
  saveOwnerTrackingStore,
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
  hydrateOwnerTrackingStoreOnce,
  refreshOwnerTrackingFromCloud,
} from "@/lib/admin-cloud-sync-client";

type Props = {
  currentUsername: string;
  isSuperAdmin?: boolean;
  /** 後台帳號（含無案件的 R001 等），供負責人篩選 */
  staffUsernames?: string[];
};

const PAGE_SIZE = 100;

/** 表頭與資料列共用（無負責人欄；上次備註加寬） */
const LIST_ROW_GRID =
  "sm:grid sm:grid-cols-[minmax(0,3.5fr)_5.5rem_8rem_6rem_6.5rem_minmax(0,2.2fr)_5.5rem_2.5rem_4.5rem] sm:items-center sm:gap-x-3";

function formatListWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const md = d.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
  const hm = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${md} ${hm}`;
}

export function OwnerTrackingList({
  currentUsername,
  isSuperAdmin = false,
  staffUsernames = [],
}: Props) {
  const [store, setStore] = useState<OwnerTrackingStore>(emptyOwnerTrackingStore);
  const [hydrated, setHydrated] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    isSuperAdmin ? "ALL" : currentUsername,
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const assigneeOptions = useMemo(() => {
    const names = new Set(staffUsernames.map((u) => u.trim()).filter(Boolean));
    for (const c of store.cases) {
      const a = c.assignee.trim();
      if (a && a !== "—") names.add(a);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [store.cases, staffUsernames]);

  useEffect(() => {
    void hydrateOwnerTrackingStoreOnce(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreLocal)
      .then((next) => {
        setStore(next);
        setSyncError(null);
        setHydrated(true);
      })
      .catch((e) => {
        setSyncError(e instanceof Error ? e.message : "雲端同步失敗");
        setStore(loadOwnerTrackingStoreLocal());
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => {
      void refreshOwnerTrackingFromCloud(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreLocal).then(
        setStore,
      );
    };
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
        assigneeFilter: isSuperAdmin ? assigneeFilter : currentUsername,
        currentUsername,
        isSuperAdmin,
      }),
    [store, keyword, statusFilter, propertyTypeFilter, assigneeFilter, currentUsername, isSuperAdmin],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter, propertyTypeFilter, assigneeFilter]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  function handleDeleteCase(caseId: string) {
    if (!isSuperAdmin) return;
    if (!window.confirm("確定刪除此案件？追蹤紀錄一併刪除，且無法復原。")) return;
    const next = deleteOwnerCase(store, caseId);
    saveOwnerTrackingStore(next);
    setStore(next);
  }

  async function onExportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const { buildOwnerTrackingWorkbook, downloadOwnerTrackingExcel } = await import(
        "@/lib/owner-tracking-excel-export"
      );
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
      {syncError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          雲端同步失敗（{syncError}），目前顯示本機快取。請重新整理或稍後再試。
        </p>
      ) : null}
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
        {isSuperAdmin ? (
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
        ) : null}
        <Link
          href="/admin/owner-tracking/new"
          className="inline-flex h-[42px] w-full items-center justify-center rounded-lg bg-[#0b2545] px-4 text-sm font-semibold text-white hover:bg-[#1e3a8a] sm:w-auto"
        >
          ＋ 新增案件
        </Link>
      </div>

      {rows.length > 0 ? (
        <p className="text-sm text-zinc-600">
          共 <span className="font-semibold tabular-nums text-zinc-900">{rows.length.toLocaleString("zh-TW")}</span>{" "}
          筆符合條件
          {rows.length > PAGE_SIZE ? (
            <>
              {" "}
              · 此頁顯示{" "}
              <span className="font-medium tabular-nums">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)}
              </span>{" "}
              · 第 {page} / {totalPages} 頁（每頁 {PAGE_SIZE} 筆）
            </>
          ) : null}
        </p>
      ) : null}

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
          <span className="min-w-0 leading-snug tabular-nums">
            建立時間
            <br />
            上次追蹤
          </span>
          <span className="min-w-0 text-center">電訪</span>
          <span className="text-center">操作</span>
        </div>
        <ul className="divide-y divide-zinc-100">
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">
              {store.cases.length === 0 ? "尚無案件，請按「新增案件」建立" : "沒有符合條件的案件"}
            </li>
          ) : (
            pageRows.map(({ case: c, last, contactCount }) => (
              <CaseRow
                key={c.id}
                item={c}
                last={last}
                contactCount={contactCount}
                isSuperAdmin={isSuperAdmin}
                onDelete={() => handleDeleteCase(c.id)}
              />
            ))
          )}
        </ul>
        </div>
      </div>

      {rows.length > PAGE_SIZE ? (
        <OwnerTrackingPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

function OwnerTrackingPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const windowPages = useMemo(() => {
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }
    const list: number[] = [];
    for (let i = start; i <= end; i++) list.push(i);
    return list;
  }, [page, totalPages]);

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 py-2"
      aria-label="屋主追蹤分頁"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        上一頁
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {windowPages[0]! > 1 ? (
          <>
            <PageButton n={1} current={page} onSelect={onPageChange} />
            {windowPages[0]! > 2 ? <span className="px-1 text-zinc-400">…</span> : null}
          </>
        ) : null}
        {windowPages.map((n) => (
          <PageButton key={n} n={n} current={page} onSelect={onPageChange} />
        ))}
        {windowPages[windowPages.length - 1]! < totalPages ? (
          <>
            {windowPages[windowPages.length - 1]! < totalPages - 1 ? (
              <span className="px-1 text-zinc-400">…</span>
            ) : null}
            <PageButton n={totalPages} current={page} onSelect={onPageChange} />
          </>
        ) : null}
      </div>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        下一頁
      </button>
    </nav>
  );
}

function PageButton({
  n,
  current,
  onSelect,
}: {
  n: number;
  current: number;
  onSelect: (page: number) => void;
}) {
  const active = n === current;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(n)}
      className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm font-medium tabular-nums ${
        active
          ? "bg-[#0b2545] text-white"
          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {n}
    </button>
  );
}

function normalizeListingUrl(url: string | null | undefined): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  return t.startsWith("http") ? t : `https://${t}`;
}

function formatListUrl(url: string | null | undefined): string {
  const t = (url ?? "").trim();
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function CaseRow({
  item,
  last,
  contactCount,
  isSuperAdmin,
  onDelete,
}: {
  item: OwnerCasePreview;
  last: OwnerFollowUpPreview | null;
  contactCount: number;
  isSuperAdmin: boolean;
  onDelete: () => void;
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
              title={(item.listingUrl ?? "").trim()}
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

        <p
          className="min-w-0 line-clamp-2 text-xs leading-snug text-zinc-600"
          title={last?.note?.trim() || undefined}
        >
          {last?.note?.trim() ? last.note.trim() : "—"}
        </p>

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

        <p className="min-w-0 text-center text-xs tabular-nums text-zinc-600">{contactCount}</p>

        <div className="pointer-events-auto relative z-20 flex min-w-0 items-center justify-center gap-2">
          <Link
            href={`/admin/owner-tracking/${item.id}/edit`}
            className="text-xs font-semibold text-[#1e3a8a] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            修改
          </Link>
          {isSuperAdmin ? (
            <button
              type="button"
              title="刪除案件"
              aria-label="刪除案件"
              className="rounded p-1 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
