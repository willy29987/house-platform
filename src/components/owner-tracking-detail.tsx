"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatFollowUpWhen,
  formatOwnerCaseAddress,
  emptyOwnerTrackingStore,
  loadOwnerTrackingStoreLocal,
  persistOwnerTrackingStoreLocal,
  newId,
  OWNER_TRACKING_STATUS_OPTIONS,
  canViewOwnerTrackingCase,
  deleteOwnerFollowUp,
  patchOwnerCaseNextContact,
  saveOwnerTrackingStore,
  statusBadgeClass,
  lastFollowUp,
  normalizeFollowUpStatus,
  type OwnerFollowUpPreview,
  type OwnerTrackingStatus,
  type OwnerCasePreview,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { COMMUNITY_PROPERTY_TYPES, PARKING_PRICE_INCLUDED_LABEL } from "@/lib/owner-tracking-form-ui";
import { formatParkingTypeLabel } from "@/lib/parking-type-label";
import { propertyTypeLabel } from "@/lib/property-type-label";
import {
  hydrateOwnerTrackingStoreOnce,
  invalidateOwnerTrackingHydrateCache,
  pushOwnerTrackingFromLocalNow,
} from "@/lib/admin-cloud-sync-client";
import { resolveOwnerCaseEffectiveStatus } from "@/lib/owner-tracking-case-status";
import {
  appendOwnerTrackingListContext,
  ownerTrackingListHrefFromListParam,
} from "@/lib/owner-tracking-list-url";
import { OwnerTrackingNextContactField } from "@/components/owner-tracking-next-contact-field";
import { formatNextContactLabel, normalizeNextContactDate } from "@/lib/owner-tracking-next-contact";
import { formatRocDate, getDaysUntilRelease } from "@/lib/listing-internal-meta";
import { isOwnerCaseUpcomingRelease } from "@/lib/owner-tracking-release";

type Props = {
  caseId: string;
  currentUsername: string;
  isSuperAdmin?: boolean;
};

export function OwnerTrackingDetail({ caseId, currentUsername, isSuperAdmin = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listParam = searchParams.get("list");
  const listHref = ownerTrackingListHrefFromListParam(listParam);
  const editHref = appendOwnerTrackingListContext(
    `/admin/owner-tracking/${caseId}/edit`,
    listParam ?? "",
  );
  const [store, setStore] = useState<OwnerTrackingStore>(emptyOwnerTrackingStore);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<OwnerTrackingStatus>("持續聯繫");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [nextContactDate, setNextContactDate] = useState("");
  const nextContactEditedByUser = useRef(false);
  const nextContactSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void hydrateOwnerTrackingStoreOnce(loadOwnerTrackingStoreLocal, persistOwnerTrackingStoreLocal).then(
      (next) => {
        setStore(next);
        setHydrated(true);
      },
    );
  }, [caseId]);

  const ownerCase = useMemo(
    () => store.cases.find((c) => c.id === caseId) ?? null,
    [store, caseId],
  );

  useEffect(() => {
    if (!ownerCase) return;
    const fromCase = normalizeNextContactDate(ownerCase.nextContactDate);
    setNextContactDate((prev) => {
      const prevNorm = normalizeNextContactDate(prev);
      if (nextContactEditedByUser.current && prevNorm !== fromCase) return prev;
      nextContactEditedByUser.current = false;
      return fromCase;
    });
  }, [ownerCase?.id, ownerCase?.nextContactDate]);

  useEffect(() => {
    if (!hydrated) return;
    const last = lastFollowUp(store, caseId);
    if (last) {
      setStatus(normalizeFollowUpStatus(last.status));
    }
  }, [hydrated, store, caseId]);

  const timeline = useMemo(
    () =>
      store.followUps
        .filter((f) => f.caseId === caseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [store, caseId],
  );

  function persistLocalOnly(next: OwnerTrackingStore) {
    persistOwnerTrackingStoreLocal(next);
    invalidateOwnerTrackingHydrateCache();
    setStore(next);
  }

  function persist(next: OwnerTrackingStore) {
    saveOwnerTrackingStore(next);
    setStore(next);
  }

  useEffect(
    () => () => {
      if (nextContactSaveTimer.current) clearTimeout(nextContactSaveTimer.current);
    },
    [],
  );

  function flushNextContactSave(ymd: string) {
    if (!hydrated || submitting) return;
    const local = loadOwnerTrackingStoreLocal();
    const current = local.cases.find((c) => c.id === caseId);
    if (!current) return;
    const formYmd = normalizeNextContactDate(ymd);
    const caseYmd = normalizeNextContactDate(current.nextContactDate);
    if (formYmd === caseYmd) {
      nextContactEditedByUser.current = false;
      return;
    }
    const next = patchOwnerCaseNextContact(local, caseId, ymd);
    persistLocalOnly(next);
    void pushOwnerTrackingFromLocalNow()
      .then(() => {
        nextContactEditedByUser.current = false;
        setFlash("已更新下次聯繫");
        window.setTimeout(() => setFlash(null), 2200);
      })
      .catch(() => {
        setFlash("聯繫日已存本機；雲端同步失敗，請稍後重新整理");
        window.setTimeout(() => setFlash(null), 4000);
      });
  }

  function handleNextContactChange(ymd: string) {
    const normalized = normalizeNextContactDate(ymd);
    nextContactEditedByUser.current = true;
    setNextContactDate(normalized);
    if (nextContactSaveTimer.current) clearTimeout(nextContactSaveTimer.current);
    nextContactSaveTimer.current = setTimeout(() => {
      nextContactSaveTimer.current = null;
      flushNextContactSave(normalized);
    }, 500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerCase || submitting) return;
    setSubmitting(true);
    const entry: OwnerFollowUpPreview = {
      id: newId("fu"),
      caseId,
      status,
      note: note.trim(),
      createdBy: currentUsername,
      createdAt: new Date().toISOString(),
    };
    const withFollowUp: OwnerTrackingStore = {
      ...store,
      followUps: [...store.followUps, entry],
    };
    const caseYmd = normalizeNextContactDate(ownerCase.nextContactDate);
    const formYmd = normalizeNextContactDate(nextContactDate);
    const nextStore =
      formYmd !== caseYmd
        ? patchOwnerCaseNextContact(withFollowUp, caseId, nextContactDate)
        : withFollowUp;
    persist(nextStore);
    try {
      await pushOwnerTrackingFromLocalNow();
    } catch {
      setFlash("已記錄於本機；雲端同步失敗，請稍後重新整理");
      setSubmitting(false);
      window.setTimeout(() => setFlash(null), 4000);
      return;
    }
    setNote("");
    setFlash("已記錄本次追蹤");
    setSubmitting(false);
    window.setTimeout(() => setFlash(null), 2500);
  }

  function handleDeleteFollowUp(followUpId: string) {
    if (!window.confirm("確定刪除此筆追蹤紀錄？")) return;
    persist(deleteOwnerFollowUp(store, followUpId));
    setFlash("已刪除追蹤紀錄");
    window.setTimeout(() => setFlash(null), 2500);
  }

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">載入中…</p>;
  }

  if (!ownerCase) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-zinc-600">找不到此案件</p>
        <Link href={listHref} className="mt-4 inline-block text-sm font-medium text-[#1e3a8a]">
          ← 回列表
        </Link>
      </div>
    );
  }

  if (!canViewOwnerTrackingCase(ownerCase, { currentUsername, isSuperAdmin })) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="font-medium text-amber-950">此案件由其他業務負責，您無法查看。</p>
        <Link href={listHref} className="mt-4 inline-block text-sm font-medium text-[#1e3a8a]">
          ← 回我的列表
        </Link>
      </div>
    );
  }

  const releaseYmd = normalizeNextContactDate(ownerCase.expectedReleaseDate);
  const upcomingRelease = isOwnerCaseUpcomingRelease(store, ownerCase);
  const releaseDays = releaseYmd ? getDaysUntilRelease(releaseYmd) : null;
  const displayStatus = resolveOwnerCaseEffectiveStatus(store, ownerCase);

  return (
    <div className="space-y-6 pb-32 lg:pb-8">
      {upcomingRelease ? (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">⏰ 即將可再開發</p>
          <p className="mt-1 text-amber-900/90">
            591 曾下架；預計{" "}
            <span className="font-bold">{formatRocDate(releaseYmd)}</span>
            {releaseDays != null && releaseDays > 0
              ? `（約 ${releaseDays} 天後）`
              : releaseDays === 0
                ? "（今日起可再聯繫）"
                : ""}
          </p>
        </div>
      ) : releaseYmd ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          預計釋出可再開發：<span className="font-semibold">{formatRocDate(releaseYmd)}</span>
        </p>
      ) : null}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{ownerCase.ownerName}</h2>
            <p className="mt-1 text-sm text-zinc-600">{ownerCase.phone}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              負責 {ownerCase.assignee}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(displayStatus)}`}
            >
              目前狀態：{displayStatus}
            </span>
            <span className="rounded-full bg-zinc-50 px-3 py-1 text-xs text-zinc-600">
              下次聯繫：{formatNextContactLabel(ownerCase.nextContactDate)}
            </span>
          </div>
        </div>
        <h3 className="mt-5 border-t border-zinc-100 pt-4 text-base font-bold text-zinc-900">案件詳細資訊</h3>
        <CaseInfoGrid item={ownerCase} />
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
          <Link
            href={editHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            修改案件
          </Link>
          <Link
            href={`/admin/listings/new?type=rent&fromOwnerCase=${encodeURIComponent(caseId)}`}
            className="inline-flex items-center rounded-lg bg-[#0b2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]"
          >
            帶入租賃上架
          </Link>
          <span className="text-xs text-zinc-500">試做：預填刊登表單，仍須補照片與確認欄位</span>
        </div>
      </div>

      <section>
        <h3 className="mb-4 text-lg font-bold text-zinc-900">追蹤紀錄</h3>
        {timeline.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            尚無紀錄，請在下方送出第一次追蹤
          </p>
        ) : (
          <ol className="relative space-y-0 border-l-2 border-zinc-200 pl-5">
            {timeline.map((item, i) => (
              <li key={item.id} className={`relative pb-8 ${i === 0 ? "pt-1" : ""}`}>
                <span
                  className={`absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${
                    i === 0 ? "bg-[#0b2545]" : "bg-zinc-300"
                  }`}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <time className="text-xs tabular-nums text-zinc-500">
                        {formatFollowUpWhen(item.createdAt)}
                      </time>
                      <span className="text-xs text-zinc-400">{item.createdBy}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.note ? (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-800">{item.note}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteFollowUp(item.id)}
                    className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="刪除此筆追蹤紀錄"
                    title="刪除"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur sm:static sm:rounded-xl sm:border sm:p-5 sm:shadow-sm"
      >
        {flash ? (
          <p className="mb-2 text-center text-sm font-medium text-emerald-700 sm:text-left" role="status">
            {flash}
          </p>
        ) : null}
        <p className="mb-3 text-sm font-bold text-zinc-900">記錄本次追蹤</p>
        <div className="mb-4 max-sm:max-h-[40vh] max-sm:overflow-y-auto">
          <OwnerTrackingNextContactField
            value={nextContactDate}
            onChange={handleNextContactChange}
            compact
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">狀態</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OwnerTrackingStatus)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
            >
              {OWNER_TRACKING_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">追蹤備註</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="h-[42px] rounded-lg bg-[#0b2545] px-6 text-sm font-semibold text-white hover:bg-[#1e3a8a] disabled:opacity-60 sm:h-auto sm:py-2.5"
          >
            {submitting ? "送出中…" : "送出"}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => router.push(listHref)}
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:hidden"
      >
        ← 回列表
      </button>
    </div>
  );
}

function CaseInfoGrid({ item }: { item: OwnerCasePreview }) {
  const typeText = propertyTypeLabel(item.propertyType);
  const parkingText = formatParkingTypeLabel(item.parking);
  const showCommunityRow =
    Boolean(item.community.trim()) ||
    (COMMUNITY_PROPERTY_TYPES as readonly string[]).includes(item.propertyType);

  const rows: { label: string; value: string; href?: string; wide?: boolean }[] = [
    { label: "物件地址", value: formatOwnerCaseAddress(item), wide: true },
    { label: "物件類別", value: typeText !== "—" ? typeText : item.propertyType },
    ...(showCommunityRow ? [{ label: "社區名稱", value: item.community }] : []),
    {
      label: "網址",
      value: item.listingUrl,
      href: item.listingUrl.startsWith("http") ? item.listingUrl : undefined,
      wide: true,
    },
    { label: "租金", value: item.rent },
    { label: "格局", value: item.layout },
    { label: "使用坪數", value: item.areaPing },
    {
      label: "管理費",
      value:
        item.managementFee.trim() === "含在租金裡"
          ? "含在租金裡"
          : item.managementFee.trim()
            ? `另計：${item.managementFee.trim()}`
            : "",
    },
    { label: "其他費用", value: item.otherFees },
    { label: "車位", value: parkingText === "無" && item.parking.trim() ? item.parking : parkingText },
    { label: "車位編號", value: item.parkingNumber },
    ...(item.parking.trim()
      ? [
          {
            label: "車位價格",
            value: (() => {
              const t = item.parkingPrice.trim();
              if (!t) return "";
              if (t === PARKING_PRICE_INCLUDED_LABEL || t.includes("含在租金")) {
                return PARKING_PRICE_INCLUDED_LABEL;
              }
              return `另計：${t}`;
            })(),
          },
        ]
      : []),
    { label: "租補", value: item.rentSubsidy },
    { label: "報稅", value: item.taxFiling },
    { label: "戶籍", value: item.householdRegistration },
    { label: "服務費", value: item.serviceFee },
    { label: "寵物", value: item.pets },
    { label: "特別事項", value: item.specialMatters, wide: true },
    { label: "姓名", value: item.ownerName },
    { label: "電話", value: item.phone },
    { label: "備註", value: item.caseNote, wide: true },
  ];

  return (
    <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map((row) => {
        const empty = !row.value?.trim();
        return (
          <div key={row.label} className={row.wide ? "sm:col-span-2" : undefined}>
            <dt className="text-zinc-500">{row.label}</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {empty ? (
                <span className="text-zinc-300">—</span>
              ) : row.href ? (
                <a href={row.href} target="_blank" rel="noopener noreferrer" className="break-all text-[#1e3a8a] hover:underline">
                  {row.value}
                </a>
              ) : (
                <span className="break-words">{row.value}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
