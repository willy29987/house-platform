"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  backfillOwnerCaseLinkedListingsFrom591,
  formatOwnerCaseAddress,
  getOwnerTrackingLocalPersistedAt,
  loadOwnerTrackingStoreLocal,
  normalizeOwnerTrackingStore,
  OWNER_TRACKING_STORAGE_KEY,
  persistOwnerTrackingStoreFromCloud,
  persistOwnerTrackingStoreLocal,
  OWNER_TRACKING_STATUS_OPTIONS,
  patchOwnerCaseMarked591Posted,
  statusBadgeClass,
  canEditOwnerTrackingCase,
  deleteOwnerCase,
  emptyOwnerTrackingStore,
  type OwnerCasePreview,
  type OwnerFollowUpPreview,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import {
  buildOwnerTrackingListRows,
  countContactDueCases,
  countContactUpcomingCases,
  listCommunityCell,
} from "@/lib/owner-tracking-list-query";
import { BUILDING_TYPE_LABEL, BUILDING_TYPE_OPTIONS } from "@/lib/house-fields";
import { propertyTypeLabel } from "@/lib/property-type-label";
import {
  ADMIN_CLOUD_DATA_KEYS,
  hydrateOwnerTrackingStoreOnce,
  cancelScheduledPushCloudPayload,
  invalidateOwnerTrackingHydrateCache,
  pushCloudPayload,
  pushOwnerTrackingStoreNow,
  refreshOwnerTrackingFromCloud,
} from "@/lib/admin-cloud-sync-client";
import { OwnerTrackingUpcomingRelease } from "@/components/owner-tracking-upcoming-release";
import { resolveOwnerCaseEffectiveStatus } from "@/lib/owner-tracking-case-status";
import { isOwnerCaseUpcomingRelease } from "@/lib/owner-tracking-release";
import { formatRocDate, getDaysUntilRelease } from "@/lib/listing-internal-meta";
import {
  appendOwnerTrackingListContext,
  buildOwnerTrackingListQuery,
  ownerTrackingListHref,
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
  isContactDueTodayView,
  normalizeNextContactDate,
} from "@/lib/owner-tracking-next-contact";
import { formatAdminStaffLabel } from "@/lib/admin-staff-labels";

type Props = {
  currentUsername: string;
  isSuperAdmin?: boolean;
  /** 後台帳號（含無案件的 R001 等），供負責人篩選 */
  staffUsernames?: string[];
  /** username → 顯示姓名 */
  staffLabels?: Record<string, string>;
  /** RSC 帶入的雲端 store，首屏免等 client hydrate */
  initialStore?: OwnerTrackingStore;
};

const PAGE_SIZE = 40;
const MAX_591_CHECK_BATCH = 30;
const SITE_LISTING_BACKFILL_SESSION_KEY = "ot:site-listing-backfill:v1";
const FOCUS_REFRESH_MIN_MS = 60_000;

const COMPACT_FILTER_LABEL = "block min-w-0";
/** 桌機等寬、剛好容納最長選項（屋主已出租／River（我））；不再撐滿整排 */
const COMPACT_FILTER_SELECT =
  "w-full min-w-0 rounded-lg border border-zinc-300 px-2 py-2 text-sm sm:w-[7.125rem]";

/** 含建立人欄，一般業務也能看出是誰建立的 */
const LIST_ROW_GRID_SUPER =
  "sm:grid sm:grid-cols-[minmax(0,3.35fr)_minmax(6rem,0.9fr)_8rem_6.25rem_6.75rem_4.25rem_5.75rem_minmax(0,1fr)_5.75rem_3.5rem_5.5rem] sm:items-stretch sm:gap-x-0";

/** 欄位分隔：桌機每格左側淺線＋內距；首欄不加左線 */
const LIST_CELL =
  "min-w-0 sm:flex sm:items-center sm:border-l sm:border-zinc-100 sm:px-2.5 sm:py-0.5 sm:first:border-l-0 sm:first:pl-0";

const LIST_HEAD_CELL = `${LIST_CELL} justify-center text-center`;

function ownerTrackingListRowGrid() {
  return LIST_ROW_GRID_SUPER;
}

/** 列表建立／上次追蹤：只顯示月／日 */
function formatListDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  });
}

/** tooltip 等仍可用含時間的格式 */
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
  staffLabels = {},
  initialStore,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(
    () => parseOwnerTrackingListSearch(searchParams, { isSuperAdmin, currentUsername }),
    [searchParams, isSuperAdmin, currentUsername],
  );
  /**
   * 篩選放在本機狀態。router.replace 會讓這頁重跑伺服器並重抓整包案件，
   * 點一次下拉就要等網路。這裡立刻換清單，網址只用 history 更新。
   */
  const [filters, setFilters] = useState(urlState);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const writtenQueryRef = useRef(searchParams.toString());
  const { keyword, statusFilter, propertyTypeFilter, assigneeFilter, listing591Filter, contactFilter, page } =
    filters;

  /** 搜尋：本地即時篩選；網址稍後跟上，同樣不走整頁導航 */
  const searchComposingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const keywordInputRef = useRef(keyword);
  const [keywordInput, setKeywordInput] = useState(keyword);
  keywordInputRef.current = keywordInput;

  const listQueryOpts = useMemo(
    () => ({ persistAllAssignee: !isSuperAdmin }),
    [isSuperAdmin],
  );

  const listQuery = useMemo(
    () => buildOwnerTrackingListQuery({ ...filters, keyword: keywordInput.trim() }, listQueryOpts),
    [filters, keywordInput, listQueryOpts],
  );

  const patchListUrl = useCallback(
    (patch: Partial<OwnerTrackingListUrlState>) => {
      const current = filtersRef.current;
      const pendingKeyword =
        !("keyword" in patch) && keywordInput.trim() !== current.keyword.trim()
          ? keywordInput.trim()
          : undefined;
      const next = {
        ...current,
        ...patch,
        ...(pendingKeyword !== undefined ? { keyword: pendingKeyword } : {}),
      };
      filtersRef.current = next;
      setFilters(next);
      const qs = buildOwnerTrackingListQuery(next, { persistAllAssignee: !isSuperAdmin });
      writtenQueryRef.current = qs;
      const url = qs ? `${pathname}?${qs}` : pathname;
      // 帶著 Next 自己的 history state（含 __NA）時，被包過的 replaceState 不會重抓這頁。
      const historyState = window.history.state;
      window.history.replaceState(historyState, "", url);
    },
    [pathname, keywordInput, isSuperAdmin],
  );

  useEffect(() => {
    const qs = searchParams.toString();
    if (qs === writtenQueryRef.current) return;
    writtenQueryRef.current = qs;
    const next = parseOwnerTrackingListSearch(searchParams, { isSuperAdmin, currentUsername });
    filtersRef.current = next;
    setFilters(next);
    setKeywordInput(next.keyword);
  }, [searchParams, isSuperAdmin, currentUsername]);

  const commitSearchToUrl = useCallback(
    (value: string) => {
      const nextKeyword = value.trim();
      if (nextKeyword === keyword.trim()) return;
      patchListUrl({ keyword: nextKeyword, page: 1 });
    },
    [keyword, patchListUrl],
  );

  useEffect(() => {
    if (searchComposingRef.current) return;
    const inputFocused = document.activeElement === searchInputRef.current;
    const inputAhead = keywordInputRef.current.trim() !== keyword.trim();
    if (inputFocused && inputAhead) return;
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

  const [store, setStore] = useState<OwnerTrackingStore>(() => {
    if (initialStore && (initialStore.cases.length > 0 || initialStore.followUps.length > 0)) {
      return initialStore;
    }
    return emptyOwnerTrackingStore;
  });
  const [hydrated, setHydrated] = useState(() =>
    Boolean(initialStore && (initialStore.cases.length > 0 || initialStore.followUps.length > 0)),
  );
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
  const lastFocusRefreshAt = useRef(0);

  const assigneeOptions = useMemo(() => {
    const names = new Set(staffUsernames.map((u) => u.trim()).filter(Boolean));
    const me = currentUsername.trim();
    if (me) names.add(me);
    for (const c of store.cases) {
      const a = c.assignee.trim();
      if (a && a !== "—") names.add(a);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }, [store.cases, staffUsernames, currentUsername]);

  useEffect(() => {
    // SSR 已有雲端資料時先寫入本機，再背景合併；否則先畫本機快取
    if (initialStore && (initialStore.cases.length > 0 || initialStore.followUps.length > 0)) {
      // 雲端 SSR 快取寫回本機：不觸發「剛本機編輯」信任窗
      persistOwnerTrackingStoreLocal(initialStore, { touchPersistedAt: false });
      setStore(initialStore);
      setHydrated(true);
    } else {
      const local = normalizeOwnerTrackingStore(loadOwnerTrackingStoreLocal());
      setStore(local);
      setHydrated(true);
    }
    void hydrateOwnerTrackingStoreOnce(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreFromCloud)
      .then((next) => {
        setStore(next);
        setSyncError(null);
      })
      .catch((e) => {
        setSyncError(e instanceof Error ? e.message : "雲端同步失敗");
        setStore(loadOwnerTrackingStoreLocal());
      });
  }, [initialStore]);

  /** 歷史案件回填：每分頁工作階段最多一次，且不上阻塞 UI */
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (sessionStorage.getItem(SITE_LISTING_BACKFILL_SESSION_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/owner-tracking/site-listing-links", {
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          ok?: boolean;
          by591Id?: Record<string, string>;
          byPhoneAddress?: Record<string, string>;
          byPhoneCommunity?: Record<string, string>;
        };
        if (!json.ok || cancelled) return;
        const local = loadOwnerTrackingStoreLocal();
        const { store: next, changed } = backfillOwnerCaseLinkedListingsFrom591(local, {
          by591Id: json.by591Id ?? {},
          byPhoneAddress: json.byPhoneAddress ?? {},
          byPhoneCommunity: json.byPhoneCommunity ?? {},
        });
        try {
          sessionStorage.setItem(SITE_LISTING_BACKFILL_SESSION_KEY, "1");
        } catch {
          /* ignore */
        }
        if (cancelled || changed === 0) return;
        persistOwnerTrackingStoreLocal(next);
        invalidateOwnerTrackingHydrateCache();
        setStore(next);
        void pushOwnerTrackingStoreNow(next).catch((e) => {
          console.warn("[owner-tracking] site listing backfill push failed", e);
        });
      } catch (e) {
        console.warn("[owner-tracking] site listing backfill failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    const local = loadOwnerTrackingListingChecksLocal();
    setCheckStore(local);
    setChecksHydrated(true);
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
      .catch(() => {
        /* keep local */
      });
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
            persistOwnerTrackingStoreFromCloud,
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
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastFocusRefreshAt.current < FOCUS_REFRESH_MIN_MS) return;
      if (now - getOwnerTrackingLocalPersistedAt() < 3000) return;
      lastFocusRefreshAt.current = now;
      void refreshOwnerTrackingFromCloud(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreFromCloud).then(
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

  /** 多人協作：進「今日待聯繫」時拉最新雲端，避免本機舊快取看不到他人剛存的日期 */
  useEffect(() => {
    if (!hydrated || !isContactDueTodayView(contactFilter)) return;
    if (Date.now() - getOwnerTrackingLocalPersistedAt() < 3000) return;
    void refreshOwnerTrackingFromCloud(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreFromCloud).then(
      setStore,
    );
  }, [contactFilter, hydrated]);

  const rows = useMemo(
    () =>
      buildOwnerTrackingListRows(store, {
        keyword: keywordInput,
        statusFilter,
        propertyTypeFilter,
        assigneeFilter,
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

  const contactDueCount = useMemo(
    () =>
      countContactDueCases(store, {
        assigneeFilter,
        isSuperAdmin,
        currentUsername,
      }),
    [store, isSuperAdmin, assigneeFilter, currentUsername],
  );

  const contactUpcomingCount = useMemo(
    () =>
      countContactUpcomingCases(store, {
        assigneeFilter,
        isSuperAdmin,
        currentUsername,
      }),
    [store, isSuperAdmin, assigneeFilter, currentUsername],
  );

  /** 今日待聯繫：新分頁開啟（僅保留負責人範圍） */
  const contactDueHref = useMemo(
    () =>
      ownerTrackingListHref(
        {
          keyword: "",
          statusFilter: "ALL",
          propertyTypeFilter: "ALL",
          assigneeFilter,
          listing591Filter: "ALL",
          contactFilter: "DUE",
          page: 1,
        },
        { persistAllAssignee: !isSuperAdmin },
      ),
    [isSuperAdmin, assigneeFilter, currentUsername],
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
    return rows.slice(start, start + PAGE_SIZE).map((row) => ({
      ...row,
      effectiveStatus: resolveOwnerCaseEffectiveStatus(store, row.case, row.last),
      upcomingRelease: isOwnerCaseUpcomingRelease(store, row.case),
    }));
  }, [rows, safePage, store]);

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
    // 延後自動檢查，避免搶佔首屏點擊／捲動
    const run = () => {
      void postListing591Check(items);
    };
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(run, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(run, 1200);
    }
    return () => {
      if (idleId != null) {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [hydrated, checksHydrated, checking591, pageRows, checkStore.byCaseId, safePage, postListing591Check]);

  const check591OnPageCount = useMemo(
    () => collect591CheckItems(pageRows, checkStore.byCaseId, { force: true }).length,
    [pageRows, checkStore.byCaseId],
  );

  const handleDeleteCase = useCallback(
    async (caseId: string) => {
      if (!isSuperAdmin || deletingId) return;
      if (!window.confirm("確定刪除此案件？追蹤紀錄一併刪除，且無法復原。")) return;
      setDeletingId(caseId);
      try {
        cancelScheduledPushCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
        const next = deleteOwnerCase(store, caseId);
        persistOwnerTrackingStoreLocal(next);
        setStore(next);
        invalidateOwnerTrackingHydrateCache();
        const res = await pushCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking, next, {
          replace: true,
        });
        if (!res.ok) {
          throw new Error("雲端儲存失敗，請重新整理後再試");
        }
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "刪除失敗");
        void refreshOwnerTrackingFromCloud(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreFromCloud).then(
          setStore,
        );
      } finally {
        setDeletingId(null);
      }
    },
    [isSuperAdmin, deletingId, store],
  );

  const handleToggleMarked591Posted = useCallback((caseId: string, marked: boolean) => {
    cancelScheduledPushCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
    const next = patchOwnerCaseMarked591Posted(loadOwnerTrackingStoreLocal(), caseId, marked);
    persistOwnerTrackingStoreLocal(next);
    setStore(next);
    invalidateOwnerTrackingHydrateCache();
    void pushOwnerTrackingStoreNow(next).catch(() => {
      void refreshOwnerTrackingFromCloud(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreFromCloud).then(
        setStore,
      );
    });
  }, []);

  async function onExportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const { buildOwnerTrackingWorkbook, downloadOwnerTrackingExcel } = await import(
        "@/lib/owner-tracking-excel-export"
      );
      const buffer = await buildOwnerTrackingWorkbook(store, rows, staffLabels);
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
          <h1 className="text-2xl font-bold text-zinc-900">屋主追蹤</h1>
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
        staffLabels={staffLabels}
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
        <div className="grid w-full grid-cols-2 gap-3 sm:inline-grid sm:w-auto sm:grid-cols-4">
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
            <span className="mb-1 block text-xs font-medium text-zinc-600">房屋型態</span>
            <select
              value={propertyTypeFilter}
              onChange={(e) => patchListUrl({ propertyTypeFilter: e.target.value, page: 1 })}
              className={COMPACT_FILTER_SELECT}
            >
              <option value="ALL">全部</option>
              {BUILDING_TYPE_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {BUILDING_TYPE_LABEL[code]}
                </option>
              ))}
              {propertyTypeFilter !== "ALL" &&
              !(BUILDING_TYPE_OPTIONS as readonly string[]).includes(propertyTypeFilter) ? (
                <option value={propertyTypeFilter}>{propertyTypeLabel(propertyTypeFilter)}</option>
              ) : null}
            </select>
          </label>
          <label className={COMPACT_FILTER_LABEL}>
            <span className="mb-1 block text-xs font-medium text-zinc-600">負責人</span>
            <select
              value={assigneeFilter}
              onChange={(e) => patchListUrl({ assigneeFilter: e.target.value, page: 1 })}
              className={COMPACT_FILTER_SELECT}
            >
              <option value="ALL">全部</option>
              {assigneeOptions.map((name) => {
                const label = formatAdminStaffLabel(name, staffLabels);
                return (
                  <option key={name} value={name}>
                    {name === currentUsername ? `${label}（我）` : label}
                  </option>
                );
              })}
            </select>
          </label>
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
        </div>
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
        <Link
          href={contactDueHref}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isContactDueTodayView(contactFilter)
              ? "inline-flex shrink-0 items-center rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-950 shadow-sm"
              : "inline-flex shrink-0 items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          }
        >
          今日待聯繫
          {contactDueCount > 0 ? (
            <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
              {contactDueCount > 99 ? "99+" : contactDueCount}
            </span>
          ) : null}
        </Link>
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
              ? contactUpcomingCount > 0
                ? `目前沒有今日待聯繫或已逾期的案件（另有 ${contactUpcomingCount} 件已排程在未來日期，到期當天會出現在此）`
                : "目前沒有今日待聯繫或已逾期的案件"
              : store.cases.length === 0
                ? null
                : "沒有符合條件的案件"}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="min-w-[76rem]">
        <div
          className={`hidden border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-500 ${ownerTrackingListRowGrid()}`}
        >
          <span className={`${LIST_HEAD_CELL} truncate`}>地址</span>
          <span className={`${LIST_HEAD_CELL} truncate`}>社區</span>
          <span className={`${LIST_HEAD_CELL} truncate`}>屋主</span>
          <span className={`${LIST_HEAD_CELL} truncate`}>網址</span>
          <span className={`${LIST_HEAD_CELL} truncate`}>目前狀態</span>
          <span className={`${LIST_HEAD_CELL} truncate`}>建立人</span>
          <span className={`${LIST_HEAD_CELL} truncate`}>下次聯繫</span>
          <span className={`${LIST_HEAD_CELL} truncate`}>上次備註</span>
          <span className={`${LIST_HEAD_CELL} flex-col leading-snug tabular-nums`}>
            <span>建立時間</span>
            <span className="my-0.5 w-full border-t border-zinc-200/80" aria-hidden />
            <span>上次追蹤</span>
          </span>
          <span className={`${LIST_HEAD_CELL} whitespace-nowrap`}>電訪</span>
          <span className={`${LIST_HEAD_CELL} whitespace-nowrap`}>操作</span>
        </div>
        <ul className="divide-y divide-zinc-100">
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">
              {store.cases.length === 0 ? (
                "尚無案件，請按「新增案件」建立"
              ) : isContactDueTodayView(contactFilter) ? (
                contactUpcomingCount > 0 ? (
                  <>
                    目前沒有今日待聯繫或已逾期的案件。
                    <br />
                    另有 {contactUpcomingCount} 件已排程在未來日期，到期當天會出現在此。
                  </>
                ) : (
                  "目前沒有今日待聯繫或已逾期的案件"
                )
              ) : (
                "沒有符合條件的案件"
              )}
            </li>
          ) : (
            pageRows.map(({ case: c, last, contactCount, effectiveStatus, upcomingRelease }) => (
              <CaseRow
                key={c.id}
                item={c}
                last={last}
                effectiveStatus={effectiveStatus}
                contactCount={contactCount}
                isSuperAdmin={isSuperAdmin}
                canEdit={canEditOwnerTrackingCase(c, { currentUsername, isSuperAdmin })}
                listQuery={listQuery}
                checkEntry={checkStore.byCaseId[c.id]}
                checking591={checking591Ids.has(c.id)}
                upcomingRelease={upcomingRelease}
                staffLabels={staffLabels}
                onDelete={handleDeleteCase}
                onToggleMarked591Posted={handleToggleMarked591Posted}
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

/** 列表「下次聯繫」只顯示月／日（不再用今日聯繫／已逾期／再聯繫文案） */
function NextContactDateCell({ nextContactDate }: { nextContactDate: string }) {
  const ymd = normalizeNextContactDate(nextContactDate);
  if (!ymd) {
    return <span className="text-sm text-zinc-400">—</span>;
  }
  const category = contactDueCategory(ymd);
  const parts = ymd.split("-");
  const label = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : ymd;
  const color =
    category === "today"
      ? "text-amber-900"
      : category === "overdue"
        ? "text-rose-800"
        : "text-zinc-800";
  return (
    <span className={`inline-block max-w-full truncate text-sm font-medium tabular-nums ${color}`} title={ymd}>
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
    return null;
  }
  const chip =
    "inline-block shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none sm:text-[11px]";
  if (checking) {
    return <span className={`${chip} text-zinc-500`}>591檢查中</span>;
  }
  const category = resolveListing591ListCategory(listingUrl, checkEntry);
  if (category === "live") {
    return (
      <span
        className={`${chip} bg-emerald-50 text-emerald-800`}
        title={
          checkEntry?.checkedAt
            ? `上次檢查：${formatListWhen(checkEntry.checkedAt)}`
            : undefined
        }
      >
        591在線
      </span>
    );
  }
  if (category === "removed") {
    return (
      <span
        className={`${chip} bg-rose-50 text-rose-800`}
        title={
          checkEntry?.checkedAt
            ? `上次檢查：${formatListWhen(checkEntry.checkedAt)}`
            : undefined
        }
      >
        591已下架
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
        className={`${chip} bg-amber-50 text-amber-900`}
        title={`${detail} · 上次：${formatListWhen(checkEntry.checkedAt)}`}
      >
        591無法確認
      </span>
    );
  }
  return (
    <span className={`${chip} text-zinc-400`} title="尚未檢查或超過 24 小時">
      591未檢查
    </span>
  );
}

function SiteListingBadge({ linkedListingId }: { linkedListingId: string }) {
  const id = linkedListingId.trim();
  if (!id) return null;
  return (
    <Link
      href={`/admin/listings/${encodeURIComponent(id)}/edit`}
      className="pointer-events-auto relative z-20 inline-block shrink-0 whitespace-nowrap rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-sky-900 hover:bg-sky-100 sm:text-[11px]"
      title="本站已上網站，點擊前往編輯"
      onClick={(e) => e.stopPropagation()}
    >
      已上網站
    </Link>
  );
}

function Marked591PostedBadge({
  marked,
  onToggle,
}: {
  marked: boolean;
  onToggle?: () => void;
}) {
  if (!marked) return null;
  if (!onToggle) {
    return (
      <span className="inline-block shrink-0 whitespace-nowrap rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-violet-900 sm:text-[11px]">
        已上591
      </span>
    );
  }
  return (
    <button
      type="button"
      className="pointer-events-auto relative z-20 inline-block shrink-0 whitespace-nowrap rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-violet-900 hover:bg-violet-100 sm:text-[11px]"
      title="手動標記：已上591（再點一下可取消）"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      已上591
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

const CaseRow = memo(function CaseRow({
  item,
  last,
  effectiveStatus,
  contactCount,
  isSuperAdmin,
  canEdit,
  listQuery,
  checkEntry,
  checking591,
  upcomingRelease,
  staffLabels = {},
  onDelete,
  onToggleMarked591Posted,
}: {
  item: OwnerCasePreview;
  last: OwnerFollowUpPreview | null;
  effectiveStatus: string;
  contactCount: number;
  isSuperAdmin: boolean;
  canEdit: boolean;
  listQuery: string;
  checkEntry: Listing591CheckEntry | undefined;
  checking591: boolean;
  upcomingRelease?: boolean;
  staffLabels?: Record<string, string>;
  onDelete: (caseId: string) => void;
  onToggleMarked591Posted: (caseId: string, marked: boolean) => void;
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
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-0"
        aria-label={`查看案件：${item.address || item.ownerName}`}
      />
      <div className={`pointer-events-none relative z-10 px-4 py-3 text-base ${ownerTrackingListRowGrid()}`}>
        <div className={`${LIST_CELL} min-w-0 overflow-hidden`}>
          <div className="flex min-h-[2.5rem] w-full min-w-0 flex-col justify-center gap-0.5 overflow-hidden">
            <p
              className="min-w-0 truncate text-base font-medium leading-snug text-zinc-900"
              title={formatOwnerCaseAddress(item)}
            >
              {formatOwnerCaseAddress(item) || "—"}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <SiteListingBadge linkedListingId={item.linkedListingId} />
              {item.linkedListingId.trim() ? null : (
                <Marked591PostedBadge
                  marked={Boolean(item.marked591Posted)}
                  onToggle={
                    canEdit
                      ? () => onToggleMarked591Posted(item.id, !item.marked591Posted)
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        </div>
        <p className={`${LIST_CELL} truncate text-base font-semibold leading-snug text-zinc-800`}>
          {listCommunityCell(item)}
        </p>
        <div className={`${LIST_CELL} overflow-hidden`}>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-base font-semibold text-zinc-900">{item.ownerName || "—"}</p>
            <p className="mt-0.5 truncate text-sm tabular-nums text-zinc-500">{item.phone || "—"}</p>
          </div>
        </div>

        <div className={`${LIST_CELL} overflow-hidden`}>
          <div className="min-w-0 space-y-0.5 overflow-hidden">
            {urlHref ? (
              <a
                href={urlHref}
                target="_blank"
                rel="noopener noreferrer"
                title={(item.listingUrl ?? "").trim()}
                className="pointer-events-auto relative z-20 block truncate text-sm text-[#1e3a8a] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {urlLabel}
              </a>
            ) : (
              <span className="pointer-events-none text-sm text-zinc-300">—</span>
            )}
            <Listing591StatusBadge
              listingUrl={item.listingUrl}
              checkEntry={checkEntry}
              checking={checking591}
            />
          </div>
        </div>

        <div className={`${LIST_CELL} justify-center overflow-hidden text-center`}>
          {last || effectiveStatus !== "持續聯繫" ? (
            <span
              className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium leading-tight sm:text-sm ${statusBadgeClass(effectiveStatus)}`}
            >
              {effectiveStatus}
            </span>
          ) : (
            <span className="text-sm text-zinc-400">尚未追蹤</span>
          )}
        </div>

        <p
          className={`${LIST_CELL} justify-center text-center truncate text-sm font-medium text-zinc-700`}
          title={item.assignee?.trim() || undefined}
        >
          <span className="mr-1 text-xs font-normal text-zinc-400 sm:hidden">建立人</span>
          {formatAdminStaffLabel(item.assignee, staffLabels)}
        </p>

        <div className={`${LIST_CELL} justify-center overflow-hidden text-center`}>
          <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden">
            <NextContactDateCell nextContactDate={item.nextContactDate} />
            {upcomingRelease && item.expectedReleaseDate ? (
              <span className="inline-block max-w-full truncate rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950 sm:text-xs">
                即將釋出 {formatRocDate(item.expectedReleaseDate)}
                {releaseDays != null && releaseDays > 0 ? `（${releaseDays} 天）` : releaseDays === 0 ? "（今日）" : ""}
              </span>
            ) : null}
          </div>
        </div>

        <p
          className={`${LIST_CELL} line-clamp-2 text-sm leading-snug text-zinc-600`}
          title={last?.note?.trim() || undefined}
        >
          {last?.note?.trim() ? last.note.trim() : "—"}
        </p>

        <div className={`${LIST_CELL} justify-center text-center`}>
          <div className="flex w-full min-w-0 flex-col items-center text-xs leading-tight tabular-nums text-zinc-600 sm:text-sm">
            <p className="w-full truncate text-center" title={formatListWhen(item.createdAt)}>
              {formatListDate(item.createdAt)}
            </p>
            <span className="my-0.5 w-full border-t border-zinc-100" aria-hidden />
            <p
              className={`w-full truncate text-center ${last ? "text-zinc-700" : "text-zinc-400"}`}
              title={last ? formatListWhen(last.createdAt) : undefined}
            >
              {last ? formatListDate(last.createdAt) : "—"}
            </p>
          </div>
        </div>

        <p className={`${LIST_CELL} justify-center text-center text-sm tabular-nums whitespace-nowrap text-zinc-600`}>
          {contactCount}
        </p>

        <div className={`${LIST_CELL} pointer-events-auto relative z-20 flex justify-center gap-2 whitespace-nowrap`}>
          {canEdit ? (
            <Link
              href={editHref}
              className="whitespace-nowrap text-sm font-semibold text-[#1e3a8a] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              修改
            </Link>
          ) : (
            <span className="text-sm text-zinc-400">查看</span>
          )}
          {isSuperAdmin ? (
            <button
              type="button"
              title="刪除案件"
              aria-label="刪除案件"
              className="rounded p-1 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
});
