"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListingAmenityGrid } from "@/components/listing-amenity-grid";
import {
  emptyViewingSchedule,
  ViewingSchedulePicker,
  type ViewingScheduleValue,
} from "@/components/viewing-schedule-picker";
import { EQUIPMENT_ITEMS, FURNITURE_ITEMS } from "@/lib/furniture-appliance-value";
import { loadLiffClient } from "@/lib/line-liff-client";
import { readClientMessagingUid } from "@/lib/line-liff-id";
import {
  EXTRA_OPTIONS,
  MATCH_LIST_LIMIT,
  RENT_PRICE_OPTIONS,
  ROOM_TYPE_OPTIONS,
  criteriaSummary,
  emptyCriteria,
  formatDateYmd,
  formatViewingRange,
  matchRentals,
  similarRentals,
  type RentalExtra,
  type RentalMatchCriteria,
  type RentalMatchListing,
} from "@/lib/line-rental-assistant";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";
import { PARKING_TYPE_LABELS } from "@/lib/parking-type-label";
import { propertyTypeLabel } from "@/lib/property-type-label";

type Step = "criteria" | "listings" | "profile";

/** 已存條件的客人從推播點進：跳過條件頁，直接開物件 */
export type LiffDirectListingEntry = {
  listingIds: string[];
  criteria: RentalMatchCriteria;
  priceMin: number | null;
  priceMax: number | null;
  petNote: string;
};

const STEPS: { id: Step; label: string }[] = [
  { id: "criteria", label: "條件" },
  { id: "listings", label: "物件" },
  { id: "profile", label: "資料" },
];

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" strokeLinecap="round" />
    </svg>
  );
}

function toggleIn(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function formatRent(price: number) {
  return `${price.toLocaleString("zh-TW")} 元/月`;
}

function listingPhotos(item: RentalMatchListing) {
  return item.images.length ? item.images : item.coverImage ? [item.coverImage] : [];
}

function listingPageUrl(baseUrl: string, id: string) {
  return `${baseUrl.replace(/\/$/, "")}/listings/${id}`;
}

function layoutLabel(item: Pick<RentalMatchListing, "propertyType" | "rooms" | "livingRooms" | "bathrooms" | "balconies">) {
  if (item.propertyType === "STUDIO") return "獨立套房";
  if (item.propertyType === "SUITE") return "分租套房";
  return [
    `${item.rooms}房`,
    item.livingRooms != null ? `${item.livingRooms}廳` : null,
    `${item.bathrooms}衛`,
    item.balconies != null ? `${item.balconies}陽台` : null,
  ]
    .filter(Boolean)
    .join("");
}

function buildingTypeLabel(item: Pick<RentalMatchListing, "propertyType" | "hasElevator">) {
  if (item.propertyType === "APARTMENT") return "公寓";
  if (item.propertyType === "ELEVATOR_BUILDING") return "電梯";
  if (item.propertyType === "STUDIO" || item.propertyType === "SUITE") {
    if (item.hasElevator === true) return "電梯";
    if (item.hasElevator === false) return "公寓";
    return "—";
  }
  return propertyTypeLabel(item.propertyType);
}

/** 地址只公開到巷或弄，不顯示門牌號。 */
function guestFacingAddress(address: string) {
  const text = address.replace(/\s+/g, "").trim();
  if (!text) return "";
  const alley = text.match(/^(.*弄)/);
  if (alley?.[1]) return alley[1];
  const lane = text.match(/^(.*巷)/);
  if (lane?.[1]) return lane[1];
  return text.replace(/\d*號.*$/, "").trim();
}

function ListingPickRow({
  item,
  selected,
  onOpen,
  onToggle,
  hideToggle = false,
}: {
  item: RentalMatchListing;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  hideToggle?: boolean;
}) {
  const photo = listingPhotos(item)[0];
  return (
    <div
      className={`flex overflow-hidden rounded-2xl border bg-white ${
        selected ? "border-[#06c755]" : "border-zinc-200"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
      >
        <span className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-bold leading-snug text-zinc-900">
            {item.title}
          </span>
          <span className="mt-1 block text-xs text-zinc-500">
            {item.city}
            {item.district}
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            {layoutLabel(item)} · {item.areaPing} 坪
          </span>
          <span className="mt-1 block text-sm font-semibold tabular-nums text-red-600">
            {formatRent(item.price)}
          </span>
        </span>
      </button>
      {hideToggle ? null : (
      <button
        type="button"
        aria-label={selected ? "取消想看" : "想看這間"}
        onClick={onToggle}
        className={`flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-l text-xs font-bold ${
          selected
            ? "border-[#06c755]/40 bg-[#06c755] text-white"
            : "border-zinc-200 bg-zinc-50 text-zinc-700"
        }`}
      >
        {selected ? "已選" : "想看"}
      </button>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm active:opacity-80 ${
        active
          ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
          : "border-zinc-200 bg-white text-zinc-700"
      } ${className}`}
    >
      {label}
    </button>
  );
}

function DetailInfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="shrink-0 text-xs font-medium text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-bold text-zinc-900">{value}</span>
    </div>
  );
}

function DetailInfoRowPair({
  left,
  right,
}: {
  left: { label: string; value: string };
  right?: { label: string; value: string };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 py-1.5">
      <DetailInfoCell label={left.label} value={left.value} />
      {right ? <DetailInfoCell label={right.label} value={right.value} /> : null}
    </div>
  );
}

function DetailInfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2.5 py-2">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function StepDots({ step, hideCriteria }: { step: Step; hideCriteria?: boolean }) {
  const steps = hideCriteria ? STEPS.filter((item) => item.id !== "criteria") : STEPS;
  const index = steps.findIndex((item) => item.id === step);
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {steps.map((item, i) => (
        <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className={`h-1.5 w-full rounded-full ${
              i <= index ? "bg-[#06c755]" : "bg-zinc-200"
            }`}
          />
          <span
            className={`text-[10px] ${
              i === index ? "font-semibold text-zinc-900" : "text-zinc-400"
            }`}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ListingDetailSheet({
  listing,
  pageUrl,
  wanted,
  onToggleWant,
  onClose,
  onWantNext,
}: {
  listing: RentalMatchListing;
  pageUrl: string;
  wanted: boolean;
  onToggleWant?: () => void;
  onClose: () => void;
  /** 有值時最下面只留「想看這間」，點了就進下一步 */
  onWantNext?: () => void;
}) {
  const photos = listingPhotos(listing);
  const [photoIndex, setPhotoIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const floorText =
    listing.floor != null && listing.totalFloors != null
      ? `${listing.floor} / ${listing.totalFloors} F`
      : listing.floor != null
        ? `${listing.floor} F`
        : listing.totalFloors != null
          ? `共 ${listing.totalFloors} F`
          : "—";

  const buildingAreaTotalText = (() => {
    const m = listing.areaMain;
    const a = listing.areaAncillary;
    if (m != null && a != null) {
      const total = m + a;
      return `${Number.isInteger(total) ? total : total.toFixed(2)} 坪`;
    }
    if (m != null) return `${m} 坪`;
    if (a != null) return `${a} 坪`;
    return "—";
  })();

  const hasParking =
    Boolean(listing.parkingType) ||
    Boolean(listing.parkingRent) ||
    Boolean(listing.areaParkingSpace);

  const parkingTypeText = listing.parkingType
    ? (PARKING_TYPE_LABELS[listing.parkingType] ?? listing.parkingType)
    : "有車位";
  const parkingRentText = listing.parkingRent
    ? `${listing.parkingRent.toLocaleString("zh-TW")} 元 / 月`
    : null;
  const managementFeeText = listing.managementFee
    ? `${listing.managementFee.toLocaleString("zh-TW")} 元/月`
    : "免管理費";
  const orientationText = listing.orientation?.trim() || "—";

  function rentConditionValue(value: boolean | null | undefined): string | null {
    if (value === true) return "可以";
    if (value === false) return "不可";
    return null;
  }

  const rentConditionItems = (
    [
      rentConditionValue(listing.petsAllowed)
        ? { label: "養寵物", value: rentConditionValue(listing.petsAllowed)! }
        : null,
      listing.taxDeductible === true ? { label: "報稅", value: "可以" } : null,
      listing.rentSubsidy === true ? { label: "租補", value: "可以" } : null,
      rentConditionValue(listing.canRegisterAddress)
        ? { label: "入戶籍", value: rentConditionValue(listing.canRegisterAddress)! }
        : null,
      listing.securityDeposit?.trim()
        ? { label: "押金", value: listing.securityDeposit.trim() }
        : null,
      listing.availableFrom?.trim()
        ? { label: "起租日", value: listing.availableFrom.trim() }
        : null,
      listing.shortTermRent?.trim()
        ? { label: "能否短租", value: listing.shortTermRent.trim() }
        : null,
      listing.serviceFee?.trim() ? { label: "服務費", value: listing.serviceFee.trim() } : null,
    ] as const
  ).filter((item): item is { label: string; value: string } => item !== null);

  const amenityGridItems = [
    ...EQUIPMENT_ITEMS.map((name) => ({ name, on: listing.equipmentItems.includes(name) })),
    ...FURNITURE_ITEMS.map((name) => ({ name, on: listing.furnitureItems.includes(name) })),
  ];

  useEffect(() => {
    setPhotoIndex(0);
    scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [listing.id]);

  function onPhotoScroll() {
    const el = scrollerRef.current;
    if (!el || photos.length === 0) return;
    const next = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    setPhotoIndex(Math.max(0, Math.min(photos.length - 1, next)));
  }

  function scrollToPhoto(index: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setPhotoIndex(index);
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black/40 p-3">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
          <p className="truncate text-sm font-bold text-zinc-900">{listing.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700"
          >
            關閉
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative bg-zinc-100">
            {photos.length > 0 ? (
              <div
                ref={scrollerRef}
                onScroll={onPhotoScroll}
                className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {photos.map((src, i) => (
                  <div key={`${src}-${i}`} className="h-full w-full shrink-0 snap-center snap-always">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-sm text-zinc-400">
                尚無照片
              </div>
            )}
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="上一張"
                  onClick={() => scrollToPhoto((photoIndex - 1 + photos.length) % photos.length)}
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-zinc-800 shadow-[0_10px_28px_rgba(24,24,27,0.18)] backdrop-blur-md"
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="下一張"
                  onClick={() => scrollToPhoto((photoIndex + 1) % photos.length)}
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-zinc-800 shadow-[0_10px_28px_rgba(24,24,27,0.18)] backdrop-blur-md"
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
                    <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <p className="absolute bottom-3 right-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-zinc-700 shadow-[0_8px_20px_rgba(24,24,27,0.12)] backdrop-blur-md">
                  {photoIndex + 1}/{photos.length}
                </p>
              </>
            ) : null}
          </div>

          <div className="space-y-5 px-3 py-4">
            <div>
              <span className="inline-block rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                出租
              </span>
              <h3 className="mt-2 text-lg font-extrabold leading-snug text-zinc-900">{listing.title}</h3>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-3xl font-extrabold tabular-nums tracking-tight text-red-600">
                  {listing.price.toLocaleString("zh-TW")}
                </span>
                <span className="text-sm font-semibold text-red-600">元/月</span>
                {listing.securityDeposit?.trim() ? (
                  <span className="text-sm text-zinc-500">押金 {listing.securityDeposit.trim()}</span>
                ) : null}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-base font-bold text-zinc-900">物件詳細資訊</h4>
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2.5">
                  <span className="shrink-0 text-xs font-medium text-zinc-500">格局</span>
                  <p className="min-w-0 text-right text-base font-bold text-zinc-900">{layoutLabel(listing)}</p>
                </div>
                <DetailInfoRowPair
                  left={{ label: "權狀坪數", value: `${listing.areaPing} 坪` }}
                  right={{ label: "主＋附屬", value: buildingAreaTotalText }}
                />
                <DetailInfoRowPair
                  left={{ label: "型態", value: buildingTypeLabel(listing) }}
                  right={{ label: "樓層", value: floorText }}
                />
                <DetailInfoRowPair
                  left={{ label: "朝向", value: orientationText }}
                  right={{ label: "管理費", value: managementFeeText }}
                />
                <DetailInfoRowPair
                  left={{ label: "車位", value: hasParking ? parkingTypeText : "無" }}
                  right={
                    hasParking && parkingRentText
                      ? { label: "車位租金", value: parkingRentText }
                      : undefined
                  }
                />
              </div>

              {rentConditionItems.length > 0 ? (
                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-bold text-zinc-900">租賃條件</h4>
                  <div
                    className={
                      rentConditionItems.length >= 2
                        ? "grid grid-cols-2 gap-2"
                        : "grid grid-cols-1 gap-2"
                    }
                  >
                    {rentConditionItems.map((item) => (
                      <DetailInfoBlock key={item.label} label={item.label} value={item.value} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {amenityGridItems.some((item) => item.on) ? (
              <div>
                <h4 className="mb-2 text-base font-bold text-zinc-900">提供設備/家具</h4>
                <ListingAmenityGrid items={amenityGridItems} />
              </div>
            ) : null}

            {listing.features.length > 0 ? (
              <div>
                <h4 className="mb-2 text-base font-bold text-zinc-900">物件特色</h4>
                <ul className="grid gap-2">
                  {listing.features.map((feature, i) => (
                    <li
                      key={`${feature}-${i}`}
                      className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b2545] text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-snug text-zinc-800">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h4 className="mb-2 text-base font-bold text-zinc-900">位置與周邊</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <dt className="w-14 shrink-0 text-zinc-500">地址</dt>
                  <dd className="min-w-0 break-words font-medium text-zinc-900">
                    {listing.city}
                    {listing.district}
                    {guestFacingAddress(listing.address)}
                  </dd>
                </div>
                {listing.community ? (
                  <div className="flex gap-3">
                    <dt className="w-14 shrink-0 text-zinc-500">社區</dt>
                    <dd className="min-w-0 font-medium text-zinc-900">{listing.community}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <a
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-semibold text-[#067a36] underline"
            >
              開啟完整物件網頁
            </a>
          </div>
        </div>
        {onWantNext ? (
          <div className="border-t border-zinc-100 p-3">
            <button
              type="button"
              onClick={onWantNext}
              className="w-full rounded-full bg-[#06c755] py-2.5 text-sm font-bold text-white"
            >
              想看這間
            </button>
          </div>
        ) : onToggleWant ? (
        <div className="border-t border-zinc-100 p-3">
          <button
            type="button"
            onClick={onToggleWant}
            className={`w-full rounded-full py-2.5 text-sm font-bold ${
              wanted ? "bg-[#06c755] text-white" : "border border-zinc-200 bg-white text-zinc-800"
            }`}
          >
            {wanted ? "已加入想看（再點取消）" : "想看這間"}
          </button>
        </div>
        ) : null}
      </div>
    </div>
  );
}

function buildGuestChatMessage(input: {
  displayName: string;
  phone: string;
  occupation: string;
  nationality: string;
  peopleCount: number;
  petNote: string;
  moveInDate: string;
  criteriaText: string;
  when: string;
  picked: { id: string; title: string; price: number }[];
  listingBaseUrl: string;
}) {
  const listingBlock = input.picked
    .map((item, index) => {
      const price =
        item.price > 0 ? `（${item.price.toLocaleString("zh-TW")} 元/月）` : "";
      const url = listingPageUrl(input.listingBaseUrl, item.id);
      return `${index + 1}. ${item.title}${price}\n${url}`;
    })
    .join("\n\n");

  return [
    "【找房預約】我想看以下物件，請協助確認時間。",
    "",
    `看屋時間：${input.when}`,
    "",
    "客戶資料：",
    `暱稱：${input.displayName}`,
    `電話：${input.phone}`,
    `人數：${input.peopleCount} 人`,
    `職業：${input.occupation}`,
    `預計入住：${input.moveInDate}`,
    `國籍：${input.nationality}`,
    `寵物：${input.petNote === "沒有" ? "沒有" : input.petNote}`,
    `條件：${input.criteriaText}`,
    "",
    "想看的物件（網頁）：",
    listingBlock,
  ].join("\n");
}

function buildOaComposeUrl(lineBasicId: string, text: string) {
  const id = lineBasicId.startsWith("@") ? lineBasicId : `@${lineBasicId}`;
  // URL 過長會失敗；留安全長度給客人一鍵傳訊（不算群發額度）
  const body = text.length > 900 ? `${text.slice(0, 880)}\n…（完整資料已送出系統）` : text;
  return `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?text=${encodeURIComponent(body)}`;
}

export function LineLiffRentForm({
  listings,
  liffId,
  lineUserId,
  displayName,
  listingBaseUrl,
  lineBasicId = "@878thkii",
  directListing = null,
  onSubmitted,
}: {
  listings: RentalMatchListing[];
  liffId: string;
  lineUserId: string | null;
  displayName: string | null;
  listingBaseUrl: string;
  lineBasicId?: string;
  directListing?: LiffDirectListingEntry | null;
  onSubmitted?: (caseId: string) => void;
}) {
  const today = useMemo(() => taipeiTodayYmd(), []);
  const skipCriteria = Boolean(directListing?.listingIds.length);
  const [step, setStep] = useState<Step>(skipCriteria ? "listings" : "criteria");
  const [criteria, setCriteria] = useState<RentalMatchCriteria>(
    directListing?.criteria ?? emptyCriteria(),
  );
  const [petHas, setPetHas] = useState<"no" | "yes" | null>(() => {
    if (!directListing?.petNote) return null;
    return directListing.petNote === "沒有" ? "no" : "yes";
  });
  const [petDraft, setPetDraft] = useState(
    directListing?.petNote && directListing.petNote !== "沒有" ? directListing.petNote : "",
  );
  const [matched, setMatched] = useState<RentalMatchListing[]>(() => {
    if (!directListing) return [];
    const ids = new Set(directListing.listingIds);
    return listings.filter((item) => ids.has(item.id));
  });
  const [matchedRelaxed, setMatchedRelaxed] = useState<string[]>([]);
  const [similar, setSimilar] = useState<RentalMatchListing[]>([]);
  const [similarNotes, setSimilarNotes] = useState<string[]>([]);
  const [watchSaved, setWatchSaved] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(
    skipCriteria ? (directListing?.listingIds[0] ?? null) : null,
  );
  const [priceCustomOn, setPriceCustomOn] = useState(
    Boolean(
      directListing &&
        directListing.criteria.priceKeys.length === 0 &&
        (directListing.priceMin != null || directListing.priceMax != null),
    ),
  );
  const [priceMin, setPriceMin] = useState(
    directListing?.priceMin != null ? String(directListing.priceMin) : "",
  );
  const [priceMax, setPriceMax] = useState(
    directListing?.priceMax != null ? String(directListing.priceMax) : "",
  );
  const [peopleCount, setPeopleCount] = useState(1);
  const [occupation, setOccupation] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [nationalityLocal, setNationalityLocal] = useState<"local" | "other" | null>(null);
  const [nationalityDraft, setNationalityDraft] = useState("");
  const [phone, setPhone] = useState("");
  const [schedule, setSchedule] = useState<ViewingScheduleValue>(emptyViewingSchedule);
  const [pickedIds, setPickedIds] = useState<string[]>(
    skipCriteria ? [...(directListing?.listingIds ?? [])] : [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ when: string; titles: string[] } | null>(null);
  /** 已有完整個資：選完物件後只問時間 */
  const [profileReady, setProfileReady] = useState(false);
  const [openViewing, setOpenViewing] = useState<{
    id: string;
    requestedWhen: string;
    titles: string[];
    picked: { id: string; title: string; price: number }[];
  } | null>(null);
  /** 從約時間頁打開上次物件時只看詳細，不出現「想看這間」 */
  const [detailReadOnly, setDetailReadOnly] = useState(false);
  const [bookSeparateTime, setBookSeparateTime] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const profileBootRef = useRef(false);
  const listingBootRef = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  useEffect(() => {
    if (profileBootRef.current) return;
    const uid = readClientMessagingUid(lineUserId) || "";
    if (!uid) return;
    profileBootRef.current = true;
    void fetch(`/api/line/guest-profile?lineUserId=${encodeURIComponent(uid)}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          complete?: boolean;
          profile?: {
            phone?: string;
            occupation?: string;
            nationality?: string;
            peopleCount?: number;
            petNote?: string;
            moveInDate?: string;
          } | null;
        };
      })
      .then((data) => {
        const profile = data?.profile;
        if (!data?.complete || !profile) return;
        setPhone(profile.phone?.trim() || "");
        setOccupation(profile.occupation?.trim() || "");
        setPeopleCount(
          Number.isFinite(profile.peopleCount) && (profile.peopleCount ?? 0) >= 1
            ? Math.min(6, Math.round(profile.peopleCount as number))
            : 1,
        );
        setMoveIn(profile.moveInDate?.trim() || "");
        const nation = profile.nationality?.trim() || "";
        if (nation === "本國") {
          setNationalityLocal("local");
          setNationalityDraft("");
        } else if (nation) {
          setNationalityLocal("other");
          setNationalityDraft(nation);
        }
        const pet = profile.petNote?.trim() || "";
        if (pet === "沒有") {
          setPetHas("no");
          setPetDraft("");
        } else if (pet) {
          setPetHas("yes");
          setPetDraft(pet);
        }
        setProfileReady(true);
      })
      .catch(() => {
        /* 沒有舊個資就照常填一次 */
      });
  }, [lineUserId]);

  useEffect(() => {
    const uid = readClientMessagingUid(lineUserId) || "";
    if (!uid) return;
    let cancelled = false;
    void fetch(`/api/line/open-viewing?lineUserId=${encodeURIComponent(uid)}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          viewing?: {
            id?: string;
            requestedWhen?: string;
            titles?: string[];
            picked?: { id?: string; title?: string; price?: number }[];
          } | null;
        };
      })
      .then((data) => {
        if (cancelled) return;
        const viewing = data?.viewing;
        if (!viewing?.id || !viewing.requestedWhen) {
          setOpenViewing(null);
          return;
        }
        const picked = Array.isArray(viewing.picked)
          ? viewing.picked
              .map((item) => ({
                id: item.id?.trim() || "",
                title: item.title?.trim() || "",
                price: Number(item.price) || 0,
              }))
              .filter((item) => item.id || item.title)
          : [];
        setOpenViewing({
          id: viewing.id,
          requestedWhen: viewing.requestedWhen,
          titles: Array.isArray(viewing.titles)
            ? viewing.titles.filter(Boolean)
            : picked.map((item) => item.title).filter(Boolean),
          picked,
        });
      })
      .catch(() => {
        /* 沒有進行中約看就照常選時間 */
      });
    return () => {
      cancelled = true;
    };
  }, [lineUserId]);

  useEffect(() => {
    if (listingBootRef.current || !listings.length) return;
    const params = new URLSearchParams(window.location.search);
    const ids = params
      .getAll("listingId")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    if (!ids.length) return;
    const found = ids
      .map((id) => listings.find((item) => item.id === id))
      .filter((item): item is RentalMatchListing => Boolean(item));
    if (!found.length || !skipCriteria) return;
    listingBootRef.current = true;
    const seed = emptyCriteria();
    seed.cities = [...new Set(found.map((item) => item.city).filter(Boolean))];
    const similarResult = similarRentals(
      listings,
      seed,
      found.map((item) => item.id),
      8,
    );
    setMatched(found);
    setSimilar(similarResult.items);
    setSimilarNotes(similarResult.notes);
    setPickedIds(found.map((item) => item.id));
    if (skipCriteria) setDetailId(found[0]?.id ?? null);
    setStep("listings");
  }, [listings, skipCriteria]);

  const cities = useMemo(
    () => [...new Set(listings.map((item) => item.city).filter(Boolean))].sort(),
    [listings],
  );
  const districts = useMemo(() => {
    const pool = criteria.cities.length
      ? listings.filter((item) => criteria.cities.includes(item.city))
      : listings;
    return [...new Set(pool.map((item) => item.district).filter(Boolean))].sort();
  }, [listings, criteria.cities]);

  const listingPool = useMemo(() => {
    const byId = new Map<string, RentalMatchListing>();
    for (const item of matched) byId.set(item.id, item);
    for (const item of similar) byId.set(item.id, item);
    return byId;
  }, [matched, similar]);

  const detailListing = detailId
    ? listingPool.get(detailId) ?? listings.find((item) => item.id === detailId) ?? null
    : null;

  const petNote =
    petHas === "no" ? "沒有" : petHas === "yes" ? petDraft.trim() : "";
  const nationality =
    nationalityLocal === "local"
      ? "本國"
      : nationalityLocal === "other"
        ? nationalityDraft.trim()
        : "";

  function togglePick(id: string) {
    setPickedIds((current) => toggleIn(current, id));
  }

  function budgetLabel() {
    const parts: string[] = [];
    if (criteria.priceKeys.length) {
      parts.push(
        ...criteria.priceKeys.map(
          (key) => RENT_PRICE_OPTIONS.find((o) => o.value === key)?.label ?? key,
        ),
      );
    }
    if (priceCustomOn) {
      const min = priceMin.trim();
      const max = priceMax.trim();
      if (min) parts.push(`最低 ${Number(min).toLocaleString("zh-TW")}`);
      if (max) parts.push(`最高 ${Number(max).toLocaleString("zh-TW")}`);
    }
    return parts.length ? `月租 ${parts.join("、")}` : "月租不限";
  }

  function goBack() {
    setError("");
    if (skipCriteria && step === "profile") {
      setStep("listings");
      setDetailId(pickedIds[0] ?? directListing?.listingIds[0] ?? null);
      return;
    }
    setDetailId(null);
    if (step === "listings") {
      if (!skipCriteria) setStep("criteria");
      return;
    }
    if (step === "profile") setStep("listings");
  }

  function reselectCriteria() {
    setError("");
    setDetailId(null);
    setPickedIds([]);
    setWatchSaved(false);
    setStep("criteria");
  }

  function applyBudgetFilter(
    items: RentalMatchListing[],
    minRaw: string,
    maxRaw: string,
    min: number,
    max: number,
  ) {
    return items.filter((item) => {
      if (minRaw && item.price < min) return false;
      if (maxRaw && item.price > max) return false;
      return true;
    });
  }

  async function persistWatchCriteria(input: {
    minRaw: string;
    maxRaw: string;
    min: number;
    max: number;
  }) {
    const uid = readClientMessagingUid(lineUserId);
    if (!uid) {
      setWatchSaved(false);
      return;
    }
    try {
      const response = await fetch("/api/line/guest-watch-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: uid,
          displayName: displayName || undefined,
          criteria,
          priceMin: input.minRaw ? input.min : null,
          priceMax: input.maxRaw ? input.max : null,
          petNote,
          active: true,
        }),
      });
      setWatchSaved(response.ok);
    } catch {
      setWatchSaved(false);
    }
  }

  function confirmCriteria() {
    if (petHas === "yes" && !petDraft.trim()) {
      setError("請填寫寵物種類");
      return;
    }
    if (!petNote) {
      setError("請選擇是否養寵物");
      return;
    }
    const minRaw = priceCustomOn ? priceMin.trim() : "";
    const maxRaw = priceCustomOn ? priceMax.trim() : "";
    const min = minRaw ? Number(minRaw) : 0;
    const max = maxRaw ? Number(maxRaw) : Number.POSITIVE_INFINITY;
    if (priceCustomOn) {
      if (!minRaw && !maxRaw) {
        setError("請填寫最低或最高預算");
        return;
      }
      if (minRaw && (!Number.isFinite(min) || min < 0)) {
        setError("請填寫有效的最低預算");
        return;
      }
      if (maxRaw && (!Number.isFinite(max) || max < 0)) {
        setError("請填寫有效的最高預算");
        return;
      }
      if (minRaw && maxRaw && min > max) {
        setError("最低預算不可高於最高預算");
        return;
      }
    }

    const result = matchRentals(listings, criteria);
    const items = applyBudgetFilter(result.items, minRaw, maxRaw, min, max).slice(
      0,
      MATCH_LIST_LIMIT,
    );
    const similarResult = similarRentals(
      listings,
      criteria,
      items.map((item) => item.id),
      8,
    );
    const similarItems = applyBudgetFilter(
      similarResult.items,
      minRaw,
      maxRaw,
      min,
      max,
    ).slice(0, 8);

    setMatched(items);
    setMatchedRelaxed(result.relaxed);
    setSimilar(similarItems);
    setSimilarNotes(similarResult.notes);
    setPickedIds([]);
    setDetailId(null);
    setError("");
    setWatchSaved(false);
    setStep("listings");
    // 每次確認條件都以最新條件覆蓋寫入（關掉 LIFF 也保留，之後新案可推）
    void persistWatchCriteria({ minRaw, maxRaw, min, max });
  }

  function wantCurrentListing() {
    const id = detailId;
    if (!id) return;
    setPickedIds((current) => (current.includes(id) ? current : [...current, id]));
    setError("");
    setDetailReadOnly(false);
    setDetailId(null);
    setEditingProfile(!profileReady);
    setStep("profile");
  }

  function confirmListings() {
    if (!pickedIds.length) {
      setError("請至少選一間想看的物件");
      return;
    }
    setError("");
    setDetailId(null);
    setEditingProfile(!profileReady);
    setStep("profile");
  }

  function profileFieldError() {
    if (!occupation.trim()) return "請填寫分別職業";
    if (!moveIn) return "請選擇預計入住日";
    if (!nationality) return "請填寫國籍";
    const phoneTrim = phone.trim();
    if (!/^09\d{8}$/.test(phoneTrim) && !/^0\d{8,12}$/.test(phoneTrim)) {
      return "請留下有效電話";
    }
    return "";
  }

  function finishProfileEdit() {
    const message = profileFieldError();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setProfileReady(true);
    setEditingProfile(false);
  }

  function confirmProfileAndSubmit() {
    const message = profileFieldError();
    if (message) {
      setError(message);
      return;
    }
    if (!formatViewingRange(schedule.date, schedule.start)) {
      setError("請選擇看屋時間");
      return;
    }
    void submit();
  }

  function joinExistingViewing() {
    const message = profileFieldError();
    if (message) {
      setError(message);
      return;
    }
    if (!openViewing) return;
    void submit({ mergeIntoCaseId: openViewing.id, when: openViewing.requestedWhen });
  }

  async function submit(options?: { mergeIntoCaseId?: string; when?: string }) {
    const when = options?.when || formatViewingRange(schedule.date, schedule.start);
    if (!when) {
      setError("請選擇看屋時間");
      return;
    }
    if (!pickedIds.length) {
      setError("請至少選一間物件");
      return;
    }

    const picked = [...pickedIds]
      .map((id) => listingPool.get(id))
      .filter((item): item is RentalMatchListing => Boolean(item))
      .map((item) => ({ id: item.id, title: item.title, price: item.price }));
    const phoneTrim = phone.trim();
    const name = displayName || "LINE 客人";
    const criteriaText = [
      ...criteriaSummary({ ...criteria, priceKeys: [] })
        .split(" · ")
        .filter((part) => !part.includes("衛浴") && !part.includes("月租")),
      budgetLabel(),
      petNote === "沒有" ? "沒有寵物" : `有養寵物（${petNote}）`,
    ].join(" · ");
    // priceKeys 已併入 budgetLabel，避免重複

    const chatText = [
      options?.mergeIntoCaseId
        ? [
            `跟上次同一個時間一起看（${when}），上一間仍保留。`,
            openViewing?.titles.length ? `原先已約：${openViewing.titles.join("、")}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "",
      buildGuestChatMessage({
        displayName: name,
        phone: phoneTrim,
        occupation: occupation.trim(),
        nationality,
        peopleCount,
        petNote,
        moveInDate: formatDateYmd(moveIn),
        criteriaText,
        when,
        picked,
        listingBaseUrl,
      }),
    ]
      .filter(Boolean)
      .join("\n\n");

    setSubmitting(true);
    setError("");
    try {
      // 不走 Bot push（避免扣群發額度）：只用意圖「客人傳訊」
      let clientSent = false;
      let clientSendError = "";
      let composeOpened = false;
      let resolvedUserId = lineUserId;
      try {
        resolvedUserId = readClientMessagingUid(resolvedUserId);
      } catch {
        /* ignore */
      }

      const outboundText =
        chatText.length > 4900 ? `${chatText.slice(0, 4890)}…` : chatText;

      let liff: Awaited<ReturnType<typeof loadLiffClient>> = null;
      if (liffId) {
        try {
          liff = await loadLiffClient();
          if (liff) {
            try {
              await liff.init({ liffId });
            } catch {
              /* 可能已 init */
            }
            if (liff.isInClient()) {
              try {
                await liff.sendMessages([{ type: "text", text: outboundText }]);
                clientSent = true;
              } catch (sendError) {
                clientSendError =
                  sendError instanceof Error ? sendError.message : "sendMessages failed";
                console.warn("[liff-rent-form] sendMessages failed", sendError);
              }
            } else {
              clientSendError = "not_in_line_client";
            }
          }
        } catch (bootError) {
          clientSendError =
            bootError instanceof Error ? bootError.message : "liff boot failed";
          console.warn("[liff-rent-form] liff boot failed", bootError);
        }
      }

      const response = await fetch("/api/line/rental-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: resolvedUserId,
          displayName: name,
          phone: phoneTrim,
          occupation: occupation.trim(),
          nationality,
          peopleCount,
          petNote,
          moveInDate: moveIn,
          criteriaText: [
            criteriaText,
            `${peopleCount} 人`,
            occupation.trim(),
            `入住 ${formatDateYmd(moveIn)}`,
            nationality,
          ].join(" · "),
          picked,
          requestedWhen: when,
          summaryText: outboundText,
          mergeIntoCaseId: options?.mergeIntoCaseId,
          // 永遠略過對客人的 push，避免吃群發額度
          skipGuestPush: true,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
        confirmText?: string;
      } | null;
      if (!response.ok || !data) {
        throw new Error(data?.error || "送出失敗");
      }

      // sendMessages 失敗（常見：LIFF 未開 chat_message.write）→ 開官方帳號傳訊頁，仍由客人送出、不扣額度
      if (!clientSent) {
        const composeUrl = buildOaComposeUrl(
          lineBasicId,
          data.confirmText || outboundText,
        );
        try {
          if (liff?.isInClient() && typeof liff.openWindow === "function") {
            liff.openWindow({ url: composeUrl, external: false });
          } else {
            window.location.href = composeUrl;
          }
          composeOpened = true;
        } catch (composeError) {
          console.warn("[liff-rent-form] oa compose failed", composeError);
          throw new Error(
            `無法自動傳回對話${clientSendError ? `（${clientSendError}）` : ""}。請到 LINE Developers 為此 LIFF 勾選 chat_message.write。`,
          );
        }
      }

      if (!clientSent && !composeOpened) {
        throw new Error("無法傳到 LINE 對話");
      }

      setDone({ when, titles: picked.map((item) => item.title) });
      if (clientSent && liff?.isInClient()) {
        try {
          liff.closeWindow();
        } catch {
          /* ignore */
        }
      }
      if (data.id) onSubmitted?.(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 bg-zinc-100 px-4 text-center">
        <p className="text-lg font-bold text-zinc-900">已送出</p>
        <div className="w-full rounded-2xl bg-white px-4 py-3 text-left text-sm text-zinc-700">
          <p>
            看屋時間：<span className="font-semibold text-zinc-900">{done.when}</span>
          </p>
          <p className="mt-2 font-semibold text-zinc-900">想看的物件</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {done.titles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-zinc-600">
          請回到 LINE 對話；若跳出傳訊畫面，點傳送即可（不扣群發額度）。
        </p>
      </div>
    );
  }

  const canContinueListings = matched.length > 0 || similar.length > 0;

  const showSavedProfile = step === "profile" && profileReady && !editingProfile;
  const offerJoin = step === "profile" && Boolean(openViewing) && !bookSeparateTime;

  const primaryLabel =
    step === "criteria"
      ? "確認條件，看物件"
      : step === "listings"
        ? canContinueListings
          ? profileReady
            ? "下一步：選看屋時間"
            : "下一步：填基本資料"
          : skipCriteria
            ? "請先看這間物件"
            : "重新挑選條件"
        : step === "profile" && editingProfile && profileReady
          ? "完成修改"
          : offerJoin
            ? submitting
              ? "送出中…"
              : "跟上次同一個時間一起看"
            : submitting
              ? "送出中…"
              : "確認送出到對話";

  function onPrimary() {
    if (step === "criteria") confirmCriteria();
    else if (step === "listings") {
      if (!canContinueListings) {
        if (!skipCriteria) reselectCriteria();
      }
      else confirmListings();
    } else if (editingProfile && profileReady) finishProfileEdit();
    else if (offerJoin) joinExistingViewing();
    else confirmProfileAndSubmit();
  }

  return (
    <div className="relative z-0 mx-auto flex min-h-dvh w-full max-w-md flex-col bg-zinc-100">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {step !== "criteria" && !(skipCriteria && step === "listings") ? (
            <button
              type="button"
              onClick={goBack}
              className="touch-manipulation rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700"
            >
              返回
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-zinc-900">找房需求表單</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              {step === "criteria"
                ? "先填找房條件"
                : step === "listings"
                  ? skipCriteria
                    ? "這間是推給你的物件，看完可直接約時間"
                    : "點物件看照片與資訊，右側點「想看」"
                  : showSavedProfile
                    ? "已有個人資料，只要選看屋時間"
                    : "填基本資料與看屋時間後送出"}
            </p>
          </div>
        </div>
        <StepDots step={step} hideCriteria={skipCriteria} />
      </header>

      <div className="flex-1 space-y-3 px-3 py-3 pb-4">
        {step === "criteria" ? (
          <Section title="找房條件">
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">縣市（可複選）</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <Chip
                    key={city}
                    label={city}
                    active={criteria.cities.includes(city)}
                    onClick={() =>
                      setCriteria((c) => ({
                        ...c,
                        cities: toggleIn(c.cities, city),
                        districts: [],
                      }))
                    }
                  />
                ))}
                <Chip
                  label="不限"
                  active={criteria.cities.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, cities: [], districts: [] }))}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">行政區（可複選）</p>
              <div className="grid grid-cols-5 gap-1.5">
                {districts.slice(0, 16).map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    active={criteria.districts.includes(d)}
                    onClick={() =>
                      setCriteria((c) => ({ ...c, districts: toggleIn(c.districts, d) }))
                    }
                    className="w-full justify-center px-1 text-xs"
                  />
                ))}
                <Chip
                  label="不限"
                  active={criteria.districts.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, districts: [] }))}
                  className="w-full justify-center px-1 text-xs"
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">房型</p>
              <div className="flex flex-wrap gap-2">
                {ROOM_TYPE_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    label={o.label}
                    active={criteria.rooms.includes(o.id)}
                    onClick={() =>
                      setCriteria((c) => ({ ...c, rooms: toggleIn(c.rooms, o.id) }))
                    }
                  />
                ))}
                <Chip
                  label="不限"
                  active={criteria.rooms.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, rooms: [] }))}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">月租預算</p>
              <div className="flex flex-wrap gap-2">
                {RENT_PRICE_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={criteria.priceKeys.includes(o.value)}
                    onClick={() => {
                      setPriceCustomOn(false);
                      setPriceMin("");
                      setPriceMax("");
                      setCriteria((c) => ({
                        ...c,
                        priceKeys: toggleIn(c.priceKeys, o.value),
                      }));
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-nowrap items-center gap-1.5">
                <Chip
                  label="自訂"
                  active={priceCustomOn}
                  onClick={() => {
                    setCriteria((c) => ({ ...c, priceKeys: [] }));
                    setPriceCustomOn((on) => {
                      if (on) {
                        setPriceMin("");
                        setPriceMax("");
                      }
                      return !on;
                    });
                  }}
                />
                {priceCustomOn ? (
                  <>
                    <span className="shrink-0 text-xs text-zinc-500">最低</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-2 py-2 text-sm text-zinc-900"
                      aria-label="最低預算"
                    />
                    <span className="shrink-0 text-xs text-zinc-500">最高</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-2 py-2 text-sm text-zinc-900"
                      aria-label="最高預算"
                    />
                  </>
                ) : null}
              </div>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="text-xs font-medium text-zinc-500">租補／報稅／入戶籍</p>
                <p className="text-[11px] text-zinc-400">若不需要或都可以請選「不限」</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXTRA_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    label={o.label}
                    active={criteria.extras.includes(o.id)}
                    onClick={() =>
                      setCriteria((c) => ({
                        ...c,
                        extras: toggleIn(c.extras, o.id) as RentalExtra[],
                      }))
                    }
                  />
                ))}
                <Chip
                  label="不限"
                  active={criteria.extras.length === 0}
                  onClick={() => setCriteria((c) => ({ ...c, extras: [] }))}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">寵物</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPetHas("no");
                    setPetDraft("");
                  }}
                  className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                    petHas === "no"
                      ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  沒有
                </button>
                <button
                  type="button"
                  onClick={() => setPetHas("yes")}
                  className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                    petHas === "yes"
                      ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                      : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  有
                </button>
                {petHas === "yes" ? (
                  <input
                    value={petDraft}
                    onChange={(e) => setPetDraft(e.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  />
                ) : null}
              </div>
            </div>
          </Section>
        ) : null}

        {step === "listings" ? (
          <>
            <Section title={`配對物件（${matched.length}）`}>
              <p className="text-xs text-zinc-500">
                點物件卡片查看照片與資訊；右側「想看」可複選。
                {matchedRelaxed.length ? `（已放寬：${matchedRelaxed.join("、")}）` : ""}
              </p>
              {matched.length === 0 ? (
                <div className="space-y-3 rounded-xl bg-zinc-50 px-3 py-4">
                  <p className="text-sm text-zinc-600">
                    目前沒有完全符合條件的物件。
                    {watchSaved
                      ? " 已幫你記住這組條件，之後有符合的新案會再通知。"
                      : " 系統會盡量記住你的條件；若之後有符合的新案會再通知。"}
                  </p>
                  {skipCriteria ? null : (
                  <button
                    type="button"
                    onClick={reselectCriteria}
                    className="touch-manipulation w-full rounded-full border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-800"
                  >
                    重新挑選條件
                  </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {matched.map((item) => (
                    <ListingPickRow
                      key={item.id}
                      item={item}
                      selected={pickedIds.includes(item.id)}
                      onOpen={() => setDetailId(item.id)}
                      onToggle={() => togglePick(item.id)}
                    />
                  ))}
                </div>
              )}
            </Section>

            {similar.length > 0 ? (
              <Section title={`類似物件（${similar.length}）`}>
                <p className="text-xs text-zinc-500">
                  符合你條件的相近物件，可一併勾選想看。
                  {similarNotes[0] ? `（${similarNotes[0]}）` : ""}
                </p>
                <div className="space-y-2">
                  {similar.map((item) => (
                    <ListingPickRow
                      key={item.id}
                      item={item}
                      selected={pickedIds.includes(item.id)}
                      onOpen={() => setDetailId(item.id)}
                      onToggle={() => togglePick(item.id)}
                    />
                  ))}
                </div>
              </Section>
            ) : null}

            {matched.length === 0 && similar.length === 0 ? (
              <p className="px-1 text-center text-xs text-zinc-500">
                也可先關閉表單；條件已登記的話，有新案再推給你。
              </p>
            ) : null}
          </>
        ) : null}

        {step === "profile" ? (
          <>
            {showSavedProfile ? (
              <Section title="已存個人資料">
                <dl className="space-y-1 text-sm text-zinc-800">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">電話</dt>
                    <dd className="font-medium">{phone}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">人數</dt>
                    <dd className="font-medium">{peopleCount} 人</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">職業</dt>
                    <dd className="font-medium">{occupation}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">入住</dt>
                    <dd className="font-medium">{moveIn ? formatDateYmd(moveIn) : "未填"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">國籍</dt>
                    <dd className="font-medium">{nationality || "未填"}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setEditingProfile(true);
                  }}
                  className="touch-manipulation rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
                >
                  修改資料
                </button>
              </Section>
            ) : (
            <Section title="基本資料">
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">幾個人住</p>
                <div className="flex flex-nowrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <label
                      key={n}
                      className={`inline-flex min-h-11 flex-1 cursor-pointer touch-manipulation items-center justify-center rounded-full border px-1 text-sm ${
                        peopleCount === n
                          ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                          : "border-zinc-200 bg-white text-zinc-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="peopleCount"
                        className="sr-only"
                        checked={peopleCount === n}
                        onChange={() => setPeopleCount(n)}
                      />
                      {n}人
                    </label>
                  ))}
                </div>
              </div>
              <label className="block text-xs font-medium text-zinc-500">
                分別職業
                <input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">預計入住日</p>
                <label className="flex cursor-pointer touch-manipulation items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                  <CalendarIcon className="h-5 w-5 shrink-0 text-zinc-500" />
                  <input
                    type="date"
                    min={today}
                    value={moveIn}
                    onChange={(e) => setMoveIn(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none"
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">國籍</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNationalityLocal("local");
                      setNationalityDraft("");
                    }}
                    className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                      nationalityLocal === "local"
                        ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    本國
                  </button>
                  <button
                    type="button"
                    onClick={() => setNationalityLocal("other")}
                    className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full border px-3 py-2 text-sm ${
                      nationalityLocal === "other"
                        ? "border-[#06c755] bg-[#e8f8ef] font-semibold text-[#067a36]"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    其他
                  </button>
                  {nationalityLocal === "other" ? (
                    <input
                      value={nationalityDraft}
                      onChange={(e) => setNationalityDraft(e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                    />
                  ) : null}
                </div>
              </div>
              <label className="block text-xs font-medium text-zinc-500">
                電話
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
            </Section>
            )}

            {openViewing ? (
              <Section title="您要跟上次挑選的物件預約同一時間嗎？">
                <p className="text-sm text-zinc-800">
                  已約時間：<span className="font-semibold">{openViewing.requestedWhen}</span>
                </p>
                <div className="space-y-2">
                  {openViewing.picked.map((item) => {
                    const full = listings.find((listing) => listing.id === item.id);
                    if (!full) {
                      return (
                        <div
                          key={item.id || item.title}
                          className="rounded-2xl border border-zinc-200 bg-white px-3 py-3"
                        >
                          <p className="text-sm font-bold text-zinc-900">{item.title}</p>
                          {item.price > 0 ? (
                            <p className="mt-1 text-sm font-semibold text-red-600">
                              {formatRent(item.price)}
                            </p>
                          ) : null}
                        </div>
                      );
                    }
                    return (
                      <ListingPickRow
                        key={full.id}
                        item={full}
                        selected={false}
                        hideToggle
                        onOpen={() => {
                          setDetailReadOnly(true);
                          setDetailId(full.id);
                        }}
                        onToggle={() => {}}
                      />
                    );
                  })}
                </div>
                {bookSeparateTime ? (
                  <button
                    type="button"
                    onClick={() => setBookSeparateTime(false)}
                    className="text-xs font-semibold text-[#067a36]"
                  >
                    改回跟上次同一個時間
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setBookSeparateTime(true);
                    }}
                    className="touch-manipulation w-full rounded-full border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-800"
                  >
                    另外約一個時間
                  </button>
                )}
              </Section>
            ) : null}
            {!openViewing || bookSeparateTime ? (
            <Section title="看屋時間">
              <p className="text-xs text-zinc-500">
                已選 {pickedIds.length} 間想看物件，選時間後送出會傳到對話。
              </p>
              <ViewingSchedulePicker
                heading="選擇日期與開始時間"
                value={schedule}
                onChange={setSchedule}
                minDate={today}
                submitLabel="時間已選"
                onSubmit={() => {
                  if (!formatViewingRange(schedule.date, schedule.start)) {
                    setError("請選擇日期與開始時間");
                  } else {
                    setError("");
                  }
                }}
              />
            </Section>
            ) : null}
          </>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-zinc-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          {error ? <p className="mb-2 text-center text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            disabled={submitting}
            onClick={onPrimary}
            className="touch-manipulation w-full rounded-full bg-[#06c755] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {primaryLabel}
          </button>
        </div>
      </footer>

      {detailListing ? (
        <ListingDetailSheet
          listing={detailListing}
          pageUrl={listingPageUrl(listingBaseUrl, detailListing.id)}
          wanted={pickedIds.includes(detailListing.id)}
          onToggleWant={
            detailReadOnly || skipCriteria ? undefined : () => togglePick(detailListing.id)
          }
          onClose={() => {
            setDetailId(null);
            setDetailReadOnly(false);
          }}
          onWantNext={skipCriteria && !detailReadOnly ? wantCurrentListing : undefined}
        />
      ) : null}
    </div>
  );
}
