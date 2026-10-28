"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatOwnerCaseAddress,
  getOwnerTrackingLocalPersistedAt,
  loadOwnerTrackingStoreLocal,
  normalizeOwnerTrackingStore,
  OWNER_TRACKING_STORAGE_KEY,
  persistOwnerTrackingStoreLocal,
  OWNER_TRACKING_STATUS_OPTIONS,
  statusBadgeClass,
  deleteOwnerCase,
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
  ADMIN_CLOUD_DATA_KEYS,
  hydrateOwnerTrackingStoreOnce,
  cancelScheduledPushCloudPayload,
  invalidateOwnerTrackingHydrateCache,
  pushCloudPayload,
  refreshOwnerTrackingFromCloud,
} from "@/lib/admin-cloud-sync-client";
import { OwnerTrackingUpcomingRelease } from "@/components/owner-tracking-upcoming-release";
import { resolveOwnerCaseEffectiveStatus } from "@/lib/owner-tracking-case-status";
import { isOwnerCaseUpcomingRelease } from "@/lib/owner-tracking-release";
import { formatRocDate, getDaysUntilRelease } from "@/lib/listing-internal-meta";
import {
  appendOwnerTrackingListContext,
  buildOwnerTrackingListQuery,
  parseOwnerTrackingListSearch,
  type OwnerTrackingListUrlState,
} from "@/lib/owner-tracking-list-url";
import {
  emptyOwnerTrackingListingChecksStore,
  is591ListingUrl,
  isListing591CheckStale,
  loadOwnerTrackingListingChecksLocal,
  mergeListing591CheckResults,
  normalizeOwnerTrackingListingChecksStore,
  persistOwnerTrackingListingChecksLocal,
  resolveListing591ListCategory,
  type Listing591CheckEntry,
  type OwnerTrackingListingChecksStore,
} from "@/lib/owner-tracking-listing-checks";
import {
  contactDueCategory,
  formatNextContactLabel,
  isContactDueTodayView,
} from "@/lib/owner-tracking-next-contact";

type Props = {
  currentUsername: string;
  isSuperAdmin?: boolean;
  /** 後台帳號（含無案件的 R001 等），供負責人篩選 */
  staffUsernames?: string[];
};

const PAGE_SIZE = 100;
const MAX_591_CHECK_BATCH = 30;

const COMPACT_FILTER_LABEL = "block shrink-0";
const COMPACT_FILTER_SELECT =
  "w-fit max-w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm";

/** 表頭與資料列共用（無負責人欄；上次備註加寬） */
const LIST_ROW_GRID =
  "sm:grid sm:grid-cols-[minmax(0,3.5fr)_5.5rem_8rem_6rem_6.5rem_5.5rem_minmax(0,2fr)_5.5rem_2.5rem_4.5rem] sm:items-center sm:gap-x-3";

function formatListWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const md = d.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
  const hm = d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${md} ${hm}`;
}

function OwnerTrackingListInner({
  currentUsername,
  isSuperAdmin = false,
  staffUsernames = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listQuery = searchParams.toString();

  const urlState = useMemo(
    () => parseOwnerTrackingListSearch(searchParams, { isSuperAdmin, currentUsername }),
    [searchParams, isSuperAdmin, currentUsername],
  );
  const { keyword, statusFilter, propertyTypeFilter, assigneeFilter, listing591Filter, contactFilter, page } =
    urlState;

  const patchListUrl = useCallback(
    (patch: Partial<OwnerTrackingListUrlState>) => {
      const next = { ...urlState, ...patch };
      const qs = buildOwnerTrackingListQuery(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [urlState, pathname, router],
  );

  /** 搜尋：本地即時篩選；URL 延遲更新，避免每鍵 router.replace 造成卡頓 */
  const searchComposingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [keywordInput, setKeywordInput] = useState(keyword);

  const commitSearchToUrl = useCallback(
    (value: string) => {
      const nextKeyword = value.trim();
      if (nextKeyword === keyword.trim()) return;
      patchListUrl({ keyword: nextKeyword, page: 1 });
    },
    [keyword, patchListUrl],
  );

  useEffect(() => {
    setKeywordInput(keyword);
  }, [keyword]);
  useEffect(() => {
    if (searchComposingRef.current) return;
    if (keywordInput.trim() === keyword.trim()) return;
    const handle = window.setTimeout(() => {
      commitSearchToUrl(keywordInput);
    }, 550);
    return () => window.clearTimeout(handle);
  }, [keywordInput, keyword, commitSearchToUrl]);

  const [store, setStore] = useState<OwnerTrackingStore>(emptyOwnerTrackingStore);
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkStore, setCheckStore] = useState<OwnerTrackingListingChecksStore>(
    emptyOwnerTrackingListingChecksStore,
  );
  const [checksHydrated, setChecksHydrated] = useState(false);
  const [checking591, setChecking591] = useState(false);
  const [checking591Ids, setChecking591Ids] = useState<Set<string>>(() => new Set());
  const [check591Error, setCheck591Error] = useState<string | null>(null);
  const autoCheckSigRef = useRef("");

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
    const local = loadOwnerTrackingListingChecksLocal();
    setCheckStore(local);
    void fetch(`/api/admin/cloud-data/${ADMIN_CLOUD_DATA_KEYS.ownerTrackingListingChecks}`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (!res.ok) return local;
        const json = (await res.json()) as { ok?: boolean; payload?: unknown };
        const cloud = normalizeOwnerTrackingListingChecksStore(json.payload);
        return mergeListing591CheckResults(local, cloud.byCaseId);
      })
      .then((merged) => {
        setCheckStore(merged);
        persistOwnerTrackingListingChecksLocal(merged);
      })
      .finally(() => setChecksHydrated(true));
  }, []);

  const postListing591Check = useCallback(async (items: { caseId: string; url: string }[]) => {
    if (items.length === 0) return;
    setChecking591(true);
    setCheck591Error(null);
    setChecking591Ids(new Set(items.map((i) => i.caseId)));
    try {
      for (let offset = 0; offset < items.length; offset += MAX_591_CHECK_BATCH) {
        const chunk = items.slice(offset, offset + MAX_591_CHECK_BATCH);
        const res = await fetch("/api/admin/owner-tracking/listing-url-check", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk }),
        });
        const raw = await res.text();
        type Listing591CheckApiResponse = {
          ok?: boolean;
          message?: string;
          results?: Record<string, Listing591CheckEntry>;
          cloudPersisted?: boolean;
          ownerTrackingUpdated?: boolean;
        };
        let json: Listing591CheckApiResponse | null = null;
        try {
          json = raw ? (JSON.parse(raw) as Listing591CheckApiResponse) : null;
        } catch {
          throw new Error(`591 檢查 API 回應異常（HTTP ${res.status}）`);
        }
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message ?? `591 檢查失敗（HTTP ${res.status}）`);
        }
        if (json.results) {
          setCheckStore((prev) => {
            const merged = mergeListing591CheckResults(prev, json.results!);
            persistOwnerTrackingListingChecksLocal(merged);
            return merged;
          });
        }
        if (json.ownerTrackingUpdated) {
          invalidateOwnerTrackingHydrateCache();
          const refreshed = await refreshOwnerTrackingFromCloud(
            loadOwnerTrackingStoreLocal,
            persistOwnerTrackingStoreLocal,
          );
          setStore(refreshed);
        }
        if (json.cloudPersisted === false) {
          setCheck591Error("檢查結果已顯示於本機；雲端未寫入（請確認 DATABASE_URL 與 prisma generate）");
        }
      }
    } catch (e) {
      setCheck591Error(e instanceof Error ? e.message : "591 檢查失敗");
    } finally {
      setChecking591(false);
      setChecking591Ids(new Set());
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => {
      if (Date.now() - getOwnerTrackingLocalPersistedAt() < 3000) return;
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

  useEffect(() => {
    if (!hydrated) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== OWNER_TRACKING_STORAGE_KEY) return;
      setStore(normalizeOwnerTrackingStore(loadOwnerTrackingStoreLocal()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrated]);

  const rows = useMemo(
    () =>
      buildOwnerTrackingListRows(store, {
        keyword: keywordInput,
        statusFilter,
        propertyTypeFilter,
        assigneeFilter: isSuperAdmin ? assigneeFilter : currentUsername,
        listing591Filter,
        contactFilter,
        listingChecksByCaseId: checkStore.byCaseId,
        currentUsername,
        isSuperAdmin,
      }),
    [
      store,
      keywordInput,
      statusFilter,
      propertyTypeFilter,
      assigneeFilter,
      listing591Filter,
      contactFilter,
      checkStore.byCaseId,
      currentUsername,
      isSuperAdmin,
    ],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      patchListUrl({ page: totalPages });
    }
  }, [page, totalPages, patchListUrl]);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  useEffect(() => {
    if (!hydrated || !checksHydrated || checking591) return;
    const items = collect591CheckItems(pageRows, checkStore.byCaseId, { force: false });
    if (items.length === 0) return;
    const sig = `${safePage}:${items
      .map((i) => i.caseId)
      .sort()
      .join(",")}`;
    if (autoCheckSigRef.current === sig) return;
    autoCheckSigRef.current = sig;
    void postListing591Check(items);
  }, [hydrated, checksHydrated, checking591, pageRows, checkStore.byCaseId, safePage, postListing591Check]);

  const check591OnPageCount = useMemo(
    () => collect591CheckItems(pageRows, checkStore.byCaseId, { force: true }).length,
    [pageRows, checkStore.byCaseId],
  );

  async function handleDeleteCase(caseId: string) {
    if (!isSuperAdmin || deletingId) return;
    if (!window.confirm("確定刪除此案件？追蹤紀錄一併刪除，且無法復原。")) return;
    setDeletingId(caseId);
    try {
      cancelScheduledPushCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
      const next = deleteOwnerCase(store, caseId);
      persistOwnerTrackingStoreLocal(next);
      setStore(next);
      invalidateOwnerTrackingHydrateCache();
      const res = await pushCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking, next);
      if (!res.ok) {
        throw new Error("雲端儲存失敗，請重新整理後再試");
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "刪除失敗");
      void refreshOwnerTrackingFromCloud(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreLocal).then(
        setStore,
      );
    } finally {
      setDeletingId(null);
    }
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
      {check591Error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
          {check591Error}
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
      <OwnerTrackingUpcomingRelease
        store={store}
        listQuery={listQuery}
        currentUsername={currentUsername}
        isSuperAdmin={isSuperAdmin}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-zinc-600">搜尋</span>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="search"
              lang="zh-Hant"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onCompositionStart={() => {
                searchComposingRef.current = true;
              }}
              onCompositionEnd={(e) => {
                searchComposingRef.current = false;
                setKeywordInput(e.currentTarget.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSearchToUrl(keywordInput);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setKeywordInput("");
                  commitSearchToUrl("");
                  searchInputRef.current?.blur();
                }
              }}
              onBlur={() => {
                if (searchComposingRef.current) return;
                commitSearchToUrl(keywordInput);
              }}
              placeholder="姓名、電話、地址、社區、備註…（空白分隔多條件）"
              className="w-full rounded-lg border border-zinc-300 py-2 pl-3 pr-9 text-sm"
              aria-label="搜尋屋主案件"
            />
            {keywordInput.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setKeywordInput("");
                  commitSearchToUrl("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="清除搜尋"
              >
                ×
              </button>
            ) : null}
          </div>
        </label>
        <label className={COMPACT_FILTER_LABEL}>
          <span className="mb-1 block text-xs font-medium text-zinc-600">目前狀態</span>
          <select
            value={statusFilter}
            onChange={(e) => patchListUrl({ statusFilter: e.target.value, page: 1 })}
            className={COMPACT_FILTER_SELECT}
          >
            <option value="ALL">全部</option>
            {OWNER_TRACKING_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={COMPACT_FILTER_LABEL}>
          <span className="mb-1 block text-xs font-medium text-zinc-600">物件類別</span>
          <select
            value={propertyTypeFilter}
            onChange={(e) => patchListUrl({ propertyTypeFilter: e.target.value, page: 1 })}
            className={COMPACT_FILTER_SELECT}
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
          <label className={COMPACT_FILTER_LABEL}>
            <span className="mb-1 block text-xs font-medium text-zinc-600">負責人</span>
            <select
              value={assigneeFilter}
              onChange={(e) => patchListUrl({ assigneeFilter: e.target.value, page: 1 })}
              className={COMPACT_FILTER_SELECT}
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
        <label className={COMPACT_FILTER_LABEL}>
          <span className="mb-1 block text-xs font-medium text-zinc-600">591 狀態</span>
          <select
            value={listing591Filter}
            onChange={(e) =>
              patchListUrl({
                listing591Filter: e.target.value as OwnerTrackingListUrlState["listing591Filter"],
                page: 1,
              })
            }
            className={COMPACT_FILTER_SELECT}
          >
            <option value="ALL">全部</option>
            <option value="LIVE">在線</option>
            <option value="REMOVED">已下架</option>
            <option value="UNCHECKED">未檢查</option>
          </select>
        </label>
        <button
          type="button"
          disabled={checking591 || check591OnPageCount === 0}
          onClick={() =>
            void postListing591Check(
              collect591CheckItems(pageRows, checkStore.byCaseId, { force: true }),
            )
          }
          className="inline-flex h-[42px] w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:w-auto"
        >
          {checking591 ? "檢查中…" : "檢查本頁 591"}
        </button>
        <Link
          href="/admin/owner-tracking/new"
          className="inline-flex h-[42px] w-full items-center justify-center rounded-lg bg-[#0b2545] px-4 text-sm font-semibold text-white hover:bg-[#1e3a8a] sm:w-auto"
        >
          ＋ 新增案件
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            patchListUrl({
              contactFilter: isContactDueTodayView(contactFilter) ? "ALL" : "DUE",
              page: 1,
            })
          }
          className={
            isContactDueTodayView(contactFilter)
              ? "inline-flex shrink-0 items-center rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-950 shadow-sm"
              : "inline-flex shrink-0 items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          }
        >
          今日待聯繫
        </button>
        {rows.length > 0 ? (
          <p className="text-sm text-zinc-600">
            共{" "}
            <span className="font-semibold tabular-nums text-zinc-900">
              {rows.length.toLocaleString("zh-TW")}
            </span>{" "}
            筆符合條件
            {isContactDueTodayView(contactFilter) ? (
              <span className="text-zinc-500">（含今日與已逾期）</span>
            ) : null}
            {rows.length > PAGE_SIZE ? (
              <>
                {" "}
                · 此頁顯示{" "}
                <span className="font-medium tabular-nums">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)}
                </span>{" "}
                · 第 {safePage} / {totalPages} 頁（每頁 {PAGE_SIZE} 筆）
              </>
            ) : null}
          </p>
        ) : hydrated ? (
          <p className="text-sm text-zinc-600">
            {isContactDueTodayView(contactFilter)
              ? "目前沒有今日待聯繫或已逾期的案件"
              : store.cases.length === 0
                ? null
                : "沒有符合條件的案件"}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="min-w-[68rem]">
        <div
          className={`hidden border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-500 ${LIST_ROW_GRID}`}
        >
          <span className="min-w-0 truncate">地址</span>
          <span className="min-w-0 truncate">社區</span>
          <span className="min-w-0 truncate">屋主</span>
          <span className="min-w-0 truncate">網址</span>
          <span className="min-w-0 truncate">目前狀態</span>
          <span className="min-w-0 truncate">下次聯繫</span>
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
                effectiveStatus={resolveOwnerCaseEffectiveStatus(store, c)}
                contactCount={contactCount}
                isSuperAdmin={isSuperAdmin}
                listQuery={listQuery}
                checkEntry={checkStore.byCaseId[c.id]}
                checking591={checking591Ids.has(c.id)}
                upcomingRelease={isOwnerCaseUpcomingRelease(store, c)}
                onDelete={() => handleDeleteCase(c.id)}
              />
            ))
          )}
        </ul>
        </div>
      </div>

      {rows.length > PAGE_SIZE ? (
        <OwnerTrackingPagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={(p) => patchListUrl({ page: p })}
        />
      ) : null}
    </div>
  );
}

export function OwnerTrackingList(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">載入列表…</p>}>
      <OwnerTrackingListInner {...props} />
    </Suspense>
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

function NextContactBadge({ nextContactDate }: { nextContactDate: string }) {
  const category = contactDueCategory(nextContactDate);
  const label = formatNextContactLabel(nextContactDate);
  if (category === "none") {
    return <span className="text-[11px] text-zinc-400 sm:text-xs">未排程</span>;
  }
  if (category === "today") {
    return (
      <span className="inline-block max-w-full truncate rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 sm:text-[11px]">
        {label}
      </span>
    );
  }
  if (category === "overdue") {
    return (
      <span className="inline-block max-w-full truncate rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 sm:text-[11px]">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-block max-w-full truncate text-[10px] font-medium text-sky-800 sm:text-[11px]">
      {label}
    </span>
  );
}

function collect591CheckItems(
  pageRows: { case: OwnerCasePreview }[],
  byCaseId: Record<string, Listing591CheckEntry>,
  opts: { force: boolean },
): { caseId: string; url: string }[] {
  const now = Date.now();
  const items: { caseId: string; url: string }[] = [];
  for (const { case: c } of pageRows) {
    if (!is591ListingUrl(c.listingUrl)) continue;
    const entry = byCaseId[c.id];
    if (opts.force || isListing591CheckStale(c.listingUrl, entry, now)) {
      items.push({ caseId: c.id, url: c.listingUrl.trim() });
    }
  }
  return items;
}

function Listing591StatusBadge({
  listingUrl,
  checkEntry,
  checking,
}: {
  listingUrl: string;
  checkEntry: Listing591CheckEntry | undefined;
  checking: boolean;
}) {
  if (!is591ListingUrl(listingUrl)) {
    return (
      <span className="inline-block max-w-full truncate text-[10px] text-zinc-400 sm:text-[11px]">
        非591
      </span>
    );
  }
  if (checking) {
    return (
      <span className="inline-block text-[10px] font-medium text-zinc-500 sm:text-[11px]">檢查中…</span>
    );
  }
  const category = resolveListing591ListCategory(listingUrl, checkEntry);
  if (category === "live") {
    return (
      <span
        className="inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 sm:text-[11px]"
        title={
          checkEntry?.checkedAt
            ? `上次檢查：${formatListWhen(checkEntry.checkedAt)}`
            : undefined
        }
      >
        在線
      </span>
    );
  }
  if (category === "removed") {
    return (
      <span
        className="inline-block rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 sm:text-[11px]"
        title={
          checkEntry?.checkedAt
            ? `上次檢查：${formatListWhen(checkEntry.checkedAt)}`
            : undefined
        }
      >
        已下架
      </span>
    );
  }
  if (
    checkEntry &&
    (checkEntry.status === "unknown" || checkEntry.status === "error")
  ) {
    const detail =
      checkEntry.httpStatus != null
        ? `HTTP ${checkEntry.httpStatus} · 591 可能阻擋自動檢查`
        : "591 可能阻擋自動檢查";
    return (
      <span
        className="inline-block max-w-full truncate rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 sm:text-[11px]"
        title={`${detail} · 上次：${formatListWhen(checkEntry.checkedAt)}`}
      >
        無法確認
      </span>
    );
  }
  return (
    <span
      className="inline-block max-w-full truncate text-[10px] text-zinc-400 sm:text-[11px]"
      title="尚未檢查或超過 24 小時"
    >
      未檢查
    </span>
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
  effectiveStatus,
  contactCount,
  isSuperAdmin,
  listQuery,
  checkEntry,
  checking591,
  upcomingRelease,
  onDelete,
}: {
  item: OwnerCasePreview;
  last: OwnerFollowUpPreview | null;
  effectiveStatus: string;
  contactCount: number;
  isSuperAdmin: boolean;
  listQuery: string;
  checkEntry: Listing591CheckEntry | undefined;
  checking591: boolean;
  upcomingRelease?: boolean;
  onDelete: () => void;
}) {
  const caseHref = appendOwnerTrackingListContext(`/admin/owner-tracking/${item.id}`, listQuery);
  const editHref = appendOwnerTrackingListContext(
    `/admin/owner-tracking/${item.id}/edit`,
    listQuery,
  );
  const urlHref = normalizeListingUrl(item.listingUrl);
  const urlLabel = formatListUrl(item.listingUrl);

  const releaseDays = upcomingRelease ? getDaysUntilRelease(item.expectedReleaseDate) : null;

  return (
    <li
      className={`relative transition hover:bg-zinc-50 ${upcomingRelease ? "border-l-4 border-l-amber-400 bg-amber-50/40 hover:bg-amber-50/70" : ""}`}
    >
      <Link
        href={caseHref}
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

        <div className="min-w-0 overflow-hidden space-y-0.5">
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
          <Listing591StatusBadge
            listingUrl={item.listingUrl}
            checkEntry={checkEntry}
            checking={checking591}
          />
        </div>

        <div className="min-w-0 overflow-hidden">
          {last ? (
            <span
              className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:text-xs ${statusBadgeClass(effectiveStatus)}`}
            >
              {effectiveStatus}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">尚未追蹤</span>
          )}
        </div>

        <div className="min-w-0 overflow-hidden space-y-0.5">
          <NextContactBadge nextContactDate={item.nextContactDate} />
          {upcomingRelease && item.expectedReleaseDate ? (
            <span className="inline-block max-w-full truncate rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 sm:text-[11px]">
              即將釋出 {formatRocDate(item.expectedReleaseDate)}
              {releaseDays != null && releaseDays > 0 ? `（${releaseDays} 天）` : releaseDays === 0 ? "（今日）" : ""}
            </span>
          ) : null}
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
            href={editHref}
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
