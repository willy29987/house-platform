"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EQUIPMENT_ITEMS, FURNITURE_ITEMS } from "@/lib/furniture-appliance-value";
import {
  inferParkingPrice,
  LAYOUT_OPEN_LABEL,
  type ParkingPriceUi,
} from "@/lib/owner-tracking-form-ui";
import { TAIWAN_REGIONS } from "@/lib/taiwan-regions";
import { PROPERTY_TYPE_LABEL, PROPERTY_TYPE_OPTIONS, type PropertyTypeOption } from "@/lib/property-type-label";
import { getMrtStationOptions, getMrtStationsForLine, MRT_LINE_OPTIONS } from "@/lib/mrt-stations";
import { LEGACY_PARKING_TYPES, PARKING_TYPE_LABELS, PARKING_TYPE_OPTIONS } from "@/lib/parking-type-label";

export type AdminListingFormData = {
  title: string;
  features: string[];
  city: string;
  district: string;
  address: string;
  community: string;
  listingType: "RENT" | "SALE";
  propertyType: PropertyTypeOption;
  price: string;
  areaPing: string;
  areaMain: string;
  areaAncillary: string;
  areaCommon: string;
  areaLand: string;
  areaParkingSpace: string;
  parkingPrice: string;
  parkingSpaceInfo: string;
  parkingRent: string;
  parkingType: string;
  parkingIncluded: "" | "yes" | "no";
  managementFee: string;
  petsAllowed: "" | "yes" | "no";
  taxDeductible: "" | "yes" | "no";
  rentSubsidy: "" | "yes" | "no";
  canRegisterAddress: "" | "yes" | "no";
  viewingMethod: "" | "KEY" | "OWNER_APPOINTMENT";
  buildingAge: string;
  orientation: string;
  decorLevel: string;
  usageZoning: string;
  hasElevator: "" | "yes" | "no";
  legalUsage: string;
  mrtLine: string;
  mrtStation: string;
  videoUrl: string;
  rooms: string;
  livingRooms: string;
  balconies: string;
  bathrooms: string;
  floor: string;
  totalFloors: string;
  coverImage: string;
  images: string[];
  contactName: string;
  contactPhone: string;
  ownerIdCardUrl: string;
  furnitureItems: string[];
  equipmentItems: string[];
  shortTermRent: string;
  serviceFee: string;
  registrationUse: string;
  specialMatters: string;
  otherFees: string;
  securityDeposit: string;
  availableFrom: string;
  householdsPerFloor: string;
  roomNumber: string;
  isPublished: boolean;
  /** 由屋主案件帶入時初始化「開放式格局」勾選；不送 API */
  layoutOpenLayoutInitial?: boolean;
};

type AdminListingFormProps = {
  mode: "create" | "edit";
  submitUrl: string;
  initialData: AdminListingFormData;
  lockedListingType?: "RENT" | "SALE";
};

const PARKING_CUSTOM = "__CUSTOM__";

type ParkingUi = { select: string; custom: string };

/** 由資料庫裡存的車位型式，推回下拉選單的選項與自訂文字。 */
function inferParking(parkingType: string): ParkingUi {
  const t = parkingType.trim();
  if (!t) return { select: "", custom: "" };
  if ((PARKING_TYPE_OPTIONS as readonly string[]).includes(t)) return { select: t, custom: "" };
  if ((LEGACY_PARKING_TYPES as readonly string[]).includes(t)) return { select: t, custom: "" };
  if (t === "OTHER") return { select: PARKING_CUSTOM, custom: PARKING_TYPE_LABELS.OTHER };
  return { select: PARKING_CUSTOM, custom: t };
}

const ORIENTATIONS = ["", "東", "西", "南", "北", "東南", "東北", "西南", "西北"];
const DECOR_LEVELS = ["", "毛胚", "簡裝", "中等裝潢", "精裝", "豪華裝潢"];
const USAGE_ZONINGS = ["", "住宅區", "商業區", "住商混合", "工業區", "其他"];

function triState(value: "" | "yes" | "no"): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

type DepositUi = { kind: "" | "two" | "other"; other: string };

function inferDeposit(securityDeposit: string): DepositUi {
  const s = securityDeposit.trim();
  if (!s) return { kind: "", other: "" };
  if (s === "2個月") return { kind: "two", other: "" };
  return { kind: "other", other: securityDeposit };
}

type AvailableUi = { mode: "" | "immediate" | "date"; date: string };

function inferAvailable(availableFrom: string): AvailableUi {
  const t = availableFrom.trim();
  if (!t) return { mode: "", date: "" };
  // 舊資料存的是「立即起租」，新資料存「隨時可遷入」，兩者都視為同一種
  if (t.includes("立即") || t.includes("隨時")) return { mode: "immediate", date: "" };
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return { mode: "date", date: m[1] };
  return { mode: "", date: "" };
}

/** 橫排列：左側粗體標題，右側選項（用於起租日、押金、家具、家電）。 */
function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
      <span className="w-24 shrink-0 text-sm font-semibold text-zinc-900">{label}</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-800">{children}</div>
    </div>
  );
}

/** 方框勾選項。 */
function CheckOption({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 accent-[#0b2545]"
      />
      {children}
    </label>
  );
}

const SHORT_TERM_CHOICES = ["一個月", "3個月", "半年"] as const;
const SERVICE_FEE_CHOICES = ["正常", "半個月", "無"] as const;

const CHOICE_OTHER = "__OTHER__";

/** 下拉選單 + 「其他」自行輸入。select 為空字串代表未填寫。 */
type ChoiceUi = { select: string; other: string };

function inferChoice(value: string, choices: readonly string[]): ChoiceUi {
  const t = value.trim();
  if (!t) return { select: "", other: "" };
  if (choices.includes(t)) return { select: t, other: "" };
  return { select: CHOICE_OTHER, other: t };
}

function choiceToValue(ui: ChoiceUi): string | null {
  if (!ui.select) return null;
  if (ui.select === CHOICE_OTHER) return ui.other.trim() || null;
  return ui.select;
}

export function AdminListingForm({ mode, submitUrl, initialData, lockedListingType }: AdminListingFormProps) {
  const [formData, setFormData] = useState(initialData);
  const [status, setStatus] = useState("");
  const [mediaStatus, setMediaStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [depositUi, setDepositUi] = useState<DepositUi>(() => inferDeposit(initialData.securityDeposit));
  const [availableUi, setAvailableUi] = useState<AvailableUi>(() => inferAvailable(initialData.availableFrom));
  const [parkingUi, setParkingUi] = useState<ParkingUi>(() => inferParking(initialData.parkingType));
  const [parkingPriceUi, setParkingPriceUi] = useState<ParkingPriceUi>(() =>
    inferParkingPrice(
      initialData.parkingRent
        ? String(initialData.parkingRent)
        : initialData.parkingType
          ? "含在租金內"
          : "",
    ),
  );
  const [layoutOpenLayout, setLayoutOpenLayout] = useState(
    () =>
      initialData.layoutOpenLayoutInitial ??
      initialData.features.some((f) => f.includes(LAYOUT_OPEN_LABEL)),
  );
  const [serviceFeeUi, setServiceFeeUi] = useState<ChoiceUi>(() =>
    inferChoice(initialData.serviceFee, SERVICE_FEE_CHOICES),
  );
  const [shortTermUi, setShortTermUi] = useState<ChoiceUi>(() =>
    inferChoice(initialData.shortTermRent, SHORT_TERM_CHOICES),
  );

  const isRent = formData.listingType === "RENT";
  const isSale = formData.listingType === "SALE";
  const hasParking = parkingUi.select !== "";
  const parkingExtraDisabled = !hasParking;
  const selectedRegion = TAIWAN_REGIONS.find((r) => r.city === formData.city);

  /** 實際要存進資料庫的車位型式：無 → null；自訂 → 使用者輸入的文字；其餘 → 代碼。 */
  const parkingTypeValue =
    parkingUi.select === ""
      ? null
      : parkingUi.select === PARKING_CUSTOM
        ? parkingUi.custom.trim() || null
        : parkingUi.select;

  const mrtStationOptions = useMemo(
    () => getMrtStationOptions(formData.mrtLine, formData.mrtStation),
    [formData.mrtLine, formData.mrtStation],
  );
  const mrtStationSelectDisabled =
    !formData.mrtLine || formData.mrtLine === "其他" || getMrtStationsForLine(formData.mrtLine).length === 0;

  async function uploadFiles(files: FileList, kind: "image" | "video") {
    if (!files.length) return;
    if (kind === "image") setUploading(true); else setUploadingVideo(true);
    setMediaStatus("");
    try {
      const fd = new FormData();
      for (const file of files) fd.append("files", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") ?? "";
      const result = contentType.includes("application/json")
        ? ((await res.json()) as { ok: boolean; urls?: string[]; message?: string })
        : ({ ok: false, message: await res.text() } as { ok: boolean; urls?: string[]; message?: string });

      if (!res.ok || !result.ok || !result.urls) {
        const fallback = kind === "video"
          ? "影片上傳失敗。正式網站需設定 Supabase Storage；單檔也請勿超過平台限制（約 4MB）。"
          : "圖片上傳失敗。正式網站請在 Vercel 設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY；本機請確認已登入後台。";
        const message = result.message || fallback;
        setMediaStatus(message);
        if (res.status === 401) {
          setMediaStatus(`${message}（登入可能已過期，請重新登入後台）`);
        }
        return;
      }

      if (kind === "image") {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...result.urls!],
          coverImage: prev.coverImage || result.urls![0] || "",
        }));
        setMediaStatus(`已上傳 ${result.urls.length} 張圖片`);
      } else {
        setFormData((prev) => ({ ...prev, videoUrl: result.urls![0] ?? prev.videoUrl }));
        setMediaStatus("影片已上傳");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知錯誤";
      setMediaStatus(`上傳失敗：${message}`);
    } finally {
      if (kind === "image") {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadingVideo(false);
        if (videoInputRef.current) videoInputRef.current.value = "";
      }
    }
  }

  function removeImage(url: string) {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((u) => u !== url),
      coverImage: prev.coverImage === url ? (prev.images.find((u) => u !== url) ?? "") : prev.coverImage,
    }));
  }

  function setCover(url: string) {
    setFormData((prev) => ({ ...prev, coverImage: url }));
  }

  function setFeatureAt(index: number, value: string) {
    setFormData((prev) => {
      const arr = [...prev.features];
      arr[index] = value;
      return { ...prev, features: arr };
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    let cleanFeatures = formData.features.map((f) => f.trim()).filter(Boolean);
    cleanFeatures = cleanFeatures.filter((f) => !f.includes(LAYOUT_OPEN_LABEL));
    if (layoutOpenLayout) {
      cleanFeatures.push(LAYOUT_OPEN_LABEL);
    }

    const payload = {
      title: formData.title,
      description: "",
      features: cleanFeatures,
      city: formData.city,
      district: formData.district,
      address: formData.address,
      community: formData.community || null,
      listingType: formData.listingType,
      propertyType: formData.propertyType,
      price: formData.listingType === "SALE"
        ? Math.round(Number(formData.price) * 10000)
        : Number(formData.price),
      areaPing: Number(formData.areaPing),
      areaMain: formData.areaMain ? Number(formData.areaMain) : null,
      areaAncillary: formData.areaAncillary ? Number(formData.areaAncillary) : null,
      areaCommon: formData.areaCommon ? Number(formData.areaCommon) : null,
      areaLand: formData.areaLand ? Number(formData.areaLand) : null,
      areaParkingSpace: formData.areaParkingSpace ? Number(formData.areaParkingSpace) : null,
      parkingPrice:
        isSale && formData.parkingPrice ? Math.round(Number(formData.parkingPrice) * 10000) : null,
      parkingSpaceInfo: formData.parkingSpaceInfo || null,
      parkingRent:
        isRent && hasParking && parkingPriceUi.mode === "separate" && parkingPriceUi.amount.trim()
          ? Number(parkingPriceUi.amount)
          : null,
      parkingType: parkingTypeValue,
      parkingIncluded: isSale ? triState(formData.parkingIncluded) : null,
      managementFee: formData.managementFee ? Number(formData.managementFee) : null,
      petsAllowed: isRent ? triState(formData.petsAllowed) : null,
      taxDeductible: isRent ? triState(formData.taxDeductible) : null,
      rentSubsidy: isRent ? triState(formData.rentSubsidy) : null,
      canRegisterAddress: isRent ? triState(formData.canRegisterAddress) : null,
      viewingMethod: isRent ? (formData.viewingMethod || null) : null,
      buildingAge: isSale && formData.buildingAge ? Number(formData.buildingAge) : null,
      orientation: isSale ? (formData.orientation || null) : null,
      decorLevel: isSale ? (formData.decorLevel || null) : null,
      usageZoning: isSale ? (formData.usageZoning || null) : null,
      hasElevator: isSale ? triState(formData.hasElevator) : null,
      legalUsage: isSale ? (formData.legalUsage || null) : null,
      mrtLine: formData.mrtLine || null,
      mrtStation: formData.mrtStation || null,
      videoUrl: formData.videoUrl || null,
      rooms: Number(formData.rooms),
      livingRooms: formData.livingRooms ? Number(formData.livingRooms) : null,
      balconies: formData.balconies ? Number(formData.balconies) : null,
      bathrooms: Number(formData.bathrooms),
      floor: formData.floor ? Number(formData.floor) : null,
      totalFloors: formData.totalFloors ? Number(formData.totalFloors) : null,
      coverImage: formData.coverImage || null,
      images: formData.images,
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      ownerIdCardUrl: formData.ownerIdCardUrl.trim() || null,
      // 有勾選任何項目就視為「有」，供列表篩選使用
      furnitureProvided: formData.furnitureItems.length > 0 ? true : null,
      applianceProvided: formData.equipmentItems.length > 0 ? true : null,
      furnitureItems: formData.furnitureItems,
      equipmentItems: formData.equipmentItems,
      shortTermRent: isRent ? choiceToValue(shortTermUi) : null,
      serviceFee: isRent ? choiceToValue(serviceFeeUi) : null,
      registrationUse: formData.registrationUse || null,
      specialMatters: formData.specialMatters.trim() || null,
      otherFees: formData.otherFees.trim() || null,
      securityDeposit: isRent
        ? depositUi.kind === "two"
          ? "2個月"
          : depositUi.kind === "other" && depositUi.other.trim()
            ? depositUi.other.trim()
            : null
        : null,
      availableFrom: isRent
        ? availableUi.mode === "immediate"
          ? "隨時可遷入"
          : availableUi.mode === "date" && availableUi.date.trim()
            ? availableUi.date.trim()
            : null
        : null,
      householdsPerFloor: formData.householdsPerFloor || null,
      roomNumber: formData.propertyType === "SUITE" ? formData.roomNumber.trim() || null : null,
      isPublished: formData.isPublished,
    };

    const response = await fetch(submitUrl, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => ({ ok: false, message: "伺服器回應異常" }))) as {
      ok: boolean;
      message?: string;
    };
    if (!response.ok || !result.ok) {
      setStatus(result.message ?? "儲存失敗，請稍後再試。");
      setLoading(false);
      return;
    }

    setStatus(mode === "create" ? "建立成功！" : "更新成功！");
    setLoading(false);
    router.refresh();
    setTimeout(() => {
      const typeParam = isRent ? "rent" : "sale";
      const qs = formData.isPublished ? "mine=1" : "mine=1&off=1";
      router.push(`/admin?type=${typeParam}&${qs}`);
    }, 500);
  }

  const field =
    "w-full rounded-xl border border-zinc-300 px-3.5 py-3 text-base outline-none focus:border-[#0b2545] focus:ring-2 focus:ring-[#0b2545]/15 sm:py-2 sm:text-sm";
  const fieldCompact = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0b2545] focus:ring-2 focus:ring-[#0b2545]/15";
  const selectCompact =
    "w-full min-w-0 rounded-lg border border-zinc-300 bg-white py-2 pl-1.5 pr-5 text-xs leading-snug outline-none focus:border-[#0b2545] focus:ring-2 focus:ring-[#0b2545]/15";
  const labelCls = "mb-1.5 block text-sm font-medium text-zinc-700 sm:text-xs sm:text-zinc-600";
  const labelCompact = "mb-1 block text-xs font-medium text-zinc-600";
  const sectionTitle =
    "mb-4 border-l-4 border-[#0b2545] pl-3 text-base font-bold text-zinc-900 sm:mb-3 sm:text-sm sm:font-semibold";
  const typeBadgeCls = isRent
    ? "inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white"
    : "inline-block rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 類型提示 */}
      <div className="flex items-center gap-2">
        <span className={typeBadgeCls}>{isRent ? "租賃" : "買賣"}</span>
      </div>

      {/* 基本資訊 */}
      <section>
        <h3 className={sectionTitle}>基本資訊</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>標題</label>
            <input required value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          {!lockedListingType ? (
            <div>
              <label className={labelCls}>類型</label>
              <select value={formData.listingType}
                onChange={(e) => setFormData((p) => ({ ...p, listingType: e.target.value as "RENT" | "SALE" }))}
                className={`w-full ${field}`}>
                <option value="RENT">租賃</option>
                <option value="SALE">買賣</option>
              </select>
            </div>
          ) : null}
          <div className="sm:col-span-2 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
              <label className="block w-full min-w-0 sm:w-[5.75rem] sm:shrink-0">
                <span className={labelCompact}>縣市</span>
                <select
                  value={formData.city}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, city: e.target.value, district: "" }));
                  }}
                  className={`${selectCompact} h-[42px] py-0`}
                >
                  <option value="">選擇縣市</option>
                  {TAIWAN_REGIONS.map((r) => (
                    <option key={r.city} value={r.city}>
                      {r.city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-full min-w-0 sm:w-[5.75rem] sm:shrink-0">
                <span className={labelCompact}>行政區</span>
                <select
                  value={formData.district}
                  onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))}
                  disabled={!selectedRegion}
                  className={`${selectCompact} h-[42px] py-0 disabled:bg-zinc-100 disabled:text-zinc-400`}
                >
                  <option value="">選擇行政區</option>
                  {selectedRegion?.districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0 flex-1">
                <span className={labelCompact}>地址</span>
                <input
                  required
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  className={`${fieldCompact} h-[42px] py-0`}
                />
              </label>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
              <label className="block w-full min-w-0 sm:w-[7.25rem] sm:shrink-0">
                <span className={labelCompact}>物件類別</span>
                <select
                  value={formData.propertyType}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      propertyType: e.target.value as AdminListingFormData["propertyType"],
                    }))
                  }
                  className={`${selectCompact} h-[42px] px-2 text-xs`}
                >
                  {PROPERTY_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {PROPERTY_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-full min-w-0 sm:w-[10.5rem] sm:shrink-0">
                <span className={labelCompact}>社區 / 大樓名稱</span>
                <input
                  value={formData.community}
                  onChange={(e) => setFormData((p) => ({ ...p, community: e.target.value }))}
                  className={`${fieldCompact} h-[42px] py-0`}
                />
              </label>
              <div className="hidden min-w-[1.25rem] flex-1 sm:block" aria-hidden />
              <label className="block w-[calc(50%-0.375rem)] min-w-0 sm:w-[3.25rem] sm:shrink-0">
                <span className={labelCompact}>樓層</span>
                <input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData((p) => ({ ...p, floor: e.target.value }))}
                  className={`${fieldCompact} h-[42px] px-1.5 py-0 text-center`}
                />
              </label>
              <label className="block w-[calc(50%-0.375rem)] min-w-0 sm:w-[3.25rem] sm:shrink-0">
                <span className={labelCompact}>總樓層</span>
                <input
                  type="number"
                  value={formData.totalFloors}
                  onChange={(e) => setFormData((p) => ({ ...p, totalFloors: e.target.value }))}
                  className={`${fieldCompact} h-[42px] px-1.5 py-0 text-center`}
                />
              </label>
            </div>
          </div>
          {formData.propertyType === "SUITE" ? (
            <div className="sm:col-span-2">
              <label className={labelCls}>房間號碼</label>
              <input
                required
                value={formData.roomNumber}
                onChange={(e) => setFormData((p) => ({ ...p, roomNumber: e.target.value }))}
                className={`w-full ${field}`}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* 坪數與格局 */}
      <section className="space-y-3">
        <h3 className={sectionTitle}>坪數與格局</h3>
        <div className="grid grid-cols-3 items-end gap-2 sm:grid-cols-5 sm:gap-3">
          <div className="min-w-0">
            <label className={labelCompact}>權狀</label>
            <input
              required
              type="number"
              min="0.1"
              step="0.01"
              value={formData.areaPing}
              onChange={(e) => setFormData((p) => ({ ...p, areaPing: e.target.value }))}
              className={`${fieldCompact} mt-1 min-w-0 px-2 py-2`}
            />
          </div>
          <div className="min-w-0 max-sm:hidden" aria-hidden />
          <div className="col-span-3 min-w-0 max-sm:col-span-3">
            <span className={labelCompact}>格局</span>
            <div className="mt-1 flex h-[42px] min-w-0 items-center gap-1.5 sm:gap-2">
              {(
                [
                  ["rooms", "房", true],
                  ["livingRooms", "廳", false],
                  ["bathrooms", "衛", true],
                  ["balconies", "陽台", false],
                ] as const
              ).map(([key, suffix, required]) => (
                <div
                  key={key}
                  className={`relative min-w-0 ${key === "balconies" ? "flex-[1.15]" : "flex-1"}`}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    required={required}
                    value={formData[key]}
                    onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
                    className={`h-[42px] w-full min-w-0 rounded-lg border bg-white py-2 pl-2 text-sm ${
                      key === "balconies" ? "pr-10" : "pr-7"
                    } ${key === "rooms" ? "border-orange-400" : "border-zinc-300"}`}
                    aria-label={`格局${suffix}`}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-800">
                    {suffix}
                  </span>
                </div>
              ))}
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap pl-0.5 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={layoutOpenLayout}
                  onChange={(e) => setLayoutOpenLayout(e.target.checked)}
                  className="size-4 shrink-0 rounded border-zinc-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                />
                開放式格局
              </label>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
          {(
            [
              ["areaMain", "主建物"],
              ["areaAncillary", "附屬建物"],
              ["areaCommon", "公設"],
              ["areaLand", "土地"],
              ["areaParkingSpace", "車位"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="min-w-0">
              <label className={labelCompact}>{label}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData[key]}
                onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value }))}
                className={`${fieldCompact} mt-1 min-w-0 px-2 py-2`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 價格與費用 */}
      <section>
        <h3 className={sectionTitle}>{isRent ? "租金與費用" : "售價與費用"}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>{isRent ? "月租" : "總售價"}</label>
            <input
              required
              type="number"
              min={isRent ? "1" : "0"}
              step={isRent ? "1" : "0.01"}
              placeholder={isRent ? "單位：元" : "單位：萬元"}
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
              className={`w-full ${field}`}
            />
            {!isRent && formData.price ? (
              <p className="mt-1 text-xs text-zinc-500">
                ≈ NT$ {(Number(formData.price) * 10000).toLocaleString("zh-TW")}
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelCls}>管理費 / 月</label>
            <input type="number" min="0" placeholder="單位：元" value={formData.managementFee}
              onChange={(e) => setFormData((p) => ({ ...p, managementFee: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          {isRent ? (
            <div>
              <label className={labelCls}>其他費用</label>
              <input
                type="text"
                value={formData.otherFees}
                onChange={(e) => setFormData((p) => ({ ...p, otherFees: e.target.value }))}
                placeholder="自行填寫"
                className={`w-full ${field}`}
              />
            </div>
          ) : null}
          {isRent ? null : (
            <div>
              <label className={labelCls}>單價 / 坪</label>
              <input
                readOnly
                value={
                  formData.price && formData.areaPing
                    ? (Number(formData.price) / Number(formData.areaPing)).toFixed(2)
                    : ""
                }
                className={`w-full bg-zinc-50 ${field}`}
              />
            </div>
          )}
        </div>
      </section>

      {/* 車位資訊 */}
      <section>
        <h3 className={sectionTitle}>車位資訊</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCompact}>車位</label>
              <select
                value={parkingUi.select}
                onChange={(e) => {
                  const select = e.target.value;
                  setParkingUi((prev) => ({ ...prev, select }));
                  if (!select) {
                    setParkingPriceUi({ mode: "included", amount: "" });
                  }
                }}
                className={`${fieldCompact} mt-1`}
              >
                <option value="">無</option>
                {PARKING_TYPE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {PARKING_TYPE_LABELS[code]}
                  </option>
                ))}
                {(LEGACY_PARKING_TYPES as readonly string[]).includes(parkingUi.select) ? (
                  <option value={parkingUi.select}>{PARKING_TYPE_LABELS[parkingUi.select]}</option>
                ) : null}
                <option value={PARKING_CUSTOM}>自訂</option>
              </select>
              {parkingUi.select === PARKING_CUSTOM ? (
                <input
                  type="text"
                  required
                  value={parkingUi.custom}
                  onChange={(e) => setParkingUi((prev) => ({ ...prev, custom: e.target.value }))}
                  className={`${fieldCompact} mt-2`}
                  placeholder="自訂車位型式"
                  aria-label="自訂車位型式"
                />
              ) : null}
            </div>
            {isRent ? (
              <div>
                <label className={labelCompact}>車位價格</label>
                <div
                  className={`mt-1 flex h-[42px] items-stretch overflow-hidden rounded-lg border border-zinc-300 ${
                    parkingExtraDisabled ? "bg-zinc-100" : "bg-white"
                  }`}
                >
                  <select
                    value={parkingPriceUi.mode}
                    disabled={parkingExtraDisabled}
                    onChange={(e) => {
                      const mode = e.target.value as ParkingPriceUi["mode"];
                      setParkingPriceUi((prev) => ({
                        mode,
                        amount: mode === "included" ? "" : prev.amount,
                      }));
                    }}
                    className={`h-full shrink-0 border-0 bg-transparent py-2 pl-3 pr-7 text-sm disabled:text-zinc-400 ${
                      parkingPriceUi.mode === "separate" && hasParking ? "max-w-[5.25rem]" : "min-w-0 flex-1"
                    }`}
                  >
                    <option value="included">含在租金內</option>
                    <option value="separate">另計</option>
                  </select>
                  {parkingPriceUi.mode === "separate" && hasParking ? (
                    <>
                      <div className="w-px shrink-0 self-stretch bg-zinc-200" aria-hidden />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={parkingPriceUi.amount}
                        onChange={(e) => setParkingPriceUi((prev) => ({ ...prev, amount: e.target.value }))}
                        className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-0"
                        placeholder="金額（元）"
                        aria-label="車位價格金額"
                      />
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div>
                <label className={labelCls}>車位價格</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="單位：萬元"
                  value={formData.parkingPrice}
                  onChange={(e) => setFormData((p) => ({ ...p, parkingPrice: e.target.value }))}
                  className={`${field} mt-1`}
                />
              </div>
            )}
            <div>
              <label className={labelCompact}>車位編號</label>
              <input
                type="text"
                value={formData.parkingSpaceInfo}
                disabled={isRent ? parkingExtraDisabled : false}
                onChange={(e) => setFormData((p) => ({ ...p, parkingSpaceInfo: e.target.value }))}
                className={`${fieldCompact} mt-1 disabled:bg-zinc-100 disabled:text-zinc-400`}
              />
            </div>
          </div>
          {isSale ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>車位是否含於總價</label>
                <select
                  value={formData.parkingIncluded}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, parkingIncluded: e.target.value as "" | "yes" | "no" }))
                  }
                  className={`w-full ${field}`}
                >
                  <option value="">未填寫</option>
                  <option value="yes">含於總價</option>
                  <option value="no">不含</option>
                </select>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* 租賃專用：條件 / 帶看 */}
      {isRent ? (
        <section>
          <h3 className={sectionTitle}>租賃條件與帶看</h3>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["rentSubsidy", "租屋補助"],
                ["taxDeductible", "報稅"],
                ["canRegisterAddress", "入戶籍"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className={labelCompact}>{label}</label>
                  <select
                    value={formData[key]}
                    onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value as "" | "yes" | "no" }))}
                    className={`${fieldCompact} mt-1 h-[42px] py-0`}
                  >
                    <option value="">未填寫</option>
                    <option value="yes">可</option>
                    <option value="no">不可</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
              <div>
                <label className={labelCompact}>帶看方式</label>
                <select
                  value={formData.viewingMethod}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, viewingMethod: e.target.value as "" | "KEY" | "OWNER_APPOINTMENT" }))
                  }
                  className={`${fieldCompact} mt-1 h-[42px] py-0`}
                >
                  <option value="">未填寫</option>
                  <option value="KEY">有鑰匙，隨時可帶看</option>
                  <option value="OWNER_APPOINTMENT">需約屋主時間</option>
                </select>
              </div>
              <div>
                <label className={labelCompact}>寵物</label>
                <select
                  value={formData.petsAllowed}
                  onChange={(e) => setFormData((p) => ({ ...p, petsAllowed: e.target.value as "" | "yes" | "no" }))}
                  className={`${fieldCompact} mt-1 h-[42px] py-0`}
                >
                  <option value="">未填寫</option>
                  <option value="yes">可</option>
                  <option value="no">不可</option>
                </select>
              </div>
              <div>
                <label className={labelCompact}>能否短租</label>
                <select
                  value={shortTermUi.select}
                  onChange={(e) =>
                    setShortTermUi((prev) => ({
                      select: e.target.value,
                      other: e.target.value === CHOICE_OTHER ? prev.other : "",
                    }))
                  }
                  className={`${fieldCompact} mt-1 h-[42px] py-0`}
                >
                  <option value="">未填寫</option>
                  {SHORT_TERM_CHOICES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={CHOICE_OTHER}>其他</option>
                </select>
                {shortTermUi.select === CHOICE_OTHER ? (
                  <input
                    type="text"
                    required
                    aria-label="短租自訂內容"
                    value={shortTermUi.other}
                    onChange={(e) => setShortTermUi({ select: CHOICE_OTHER, other: e.target.value })}
                    className={`${fieldCompact} mt-2`}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* 服務費 */}
      {isRent ? (
        <section>
          <h3 className={sectionTitle}>服務費</h3>
          <div className="grid grid-cols-1 sm:max-w-[calc(50%-0.375rem)]">
            <div>
              <span className={labelCompact}>服務費</span>
              <select
                value={serviceFeeUi.select}
                onChange={(e) =>
                  setServiceFeeUi((prev) => ({
                    select: e.target.value,
                    other: e.target.value === CHOICE_OTHER ? prev.other : "",
                  }))
                }
                className={`${fieldCompact} mt-1 h-[42px] py-0`}
              >
                <option value="">未填寫</option>
                {SERVICE_FEE_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={CHOICE_OTHER}>其他</option>
              </select>
              {serviceFeeUi.select === CHOICE_OTHER ? (
                <input
                  type="text"
                  required
                  value={serviceFeeUi.other}
                  onChange={(e) => setServiceFeeUi({ select: CHOICE_OTHER, other: e.target.value })}
                  className={`${fieldCompact} mt-2`}
                  placeholder="自訂服務費"
                  aria-label="服務費自訂"
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* 屋主聯絡資訊 */}
      <section>
        <h3 className={sectionTitle}>屋主聯絡資訊</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>屋主姓名</label>
            <input required value={formData.contactName}
              onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>屋主電話</label>
            <input required value={formData.contactPhone}
              onChange={(e) => setFormData((p) => ({ ...p, contactPhone: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>屋主身分證字號</label>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={20}
              value={formData.ownerIdCardUrl}
              onChange={(e) => setFormData((p) => ({ ...p, ownerIdCardUrl: e.target.value }))}
              className={`w-full ${field}`}
            />
          </div>
        </div>
      </section>

      {/* 鄰近捷運 */}
      <section>
        <h3 className={sectionTitle}>鄰近捷運</h3>
        <p className="-mt-1 mb-3 text-xs text-zinc-500">
          若物件鄰近捷運站，可填寫此欄位。會顯示在外網物件卡片與詳情頁，方便客戶辨識交通。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>捷運線</label>
            <select value={formData.mrtLine}
              onChange={(e) => {
                const mrtLine = e.target.value;
                setFormData((p) => {
                  const stations = getMrtStationsForLine(mrtLine);
                  const keepStation = stations.includes(p.mrtStation);
                  return { ...p, mrtLine, mrtStation: keepStation ? p.mrtStation : "" };
                });
              }}
              className={`w-full ${field}`}>
              {MRT_LINE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l || "未填寫"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>捷運站</label>
            <select
              value={formData.mrtStation}
              disabled={mrtStationSelectDisabled}
              onChange={(e) => setFormData((p) => ({ ...p, mrtStation: e.target.value }))}
              className={`w-full ${field} disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500`}
            >
              <option value="">{mrtStationSelectDisabled ? "請先選擇捷運線" : "請選擇捷運站"}</option>
              {mrtStationOptions.map((station) => (
                <option key={station} value={station}>
                  {station}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 買賣專用：建物資訊 */}
      {isSale ? (
        <section>
          <h3 className={sectionTitle}>建物資訊</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>屋齡</label>
              <input type="number" min="0" step="0.1" placeholder="單位：年" value={formData.buildingAge}
                onChange={(e) => setFormData((p) => ({ ...p, buildingAge: e.target.value }))}
                className={`w-full ${field}`} />
            </div>
            <div>
              <label className={labelCls}>朝向</label>
              <select value={formData.orientation}
                onChange={(e) => setFormData((p) => ({ ...p, orientation: e.target.value }))}
                className={`w-full ${field}`}>
                {ORIENTATIONS.map((o) => (
                  <option key={o} value={o}>{o || "未填寫"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>電梯</label>
              <select value={formData.hasElevator}
                onChange={(e) => setFormData((p) => ({ ...p, hasElevator: e.target.value as "" | "yes" | "no" }))}
                className={`w-full ${field}`}>
                <option value="">未填寫</option>
                <option value="yes">有電梯</option>
                <option value="no">無電梯</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>裝潢程度</label>
              <select value={formData.decorLevel}
                onChange={(e) => setFormData((p) => ({ ...p, decorLevel: e.target.value }))}
                className={`w-full ${field}`}>
                {DECOR_LEVELS.map((d) => (
                  <option key={d} value={d}>{d || "未填寫"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>使用分區</label>
              <select value={formData.usageZoning}
                onChange={(e) => setFormData((p) => ({ ...p, usageZoning: e.target.value }))}
                className={`w-full ${field}`}>
                {USAGE_ZONINGS.map((u) => (
                  <option key={u} value={u}>{u || "未填寫"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>法定用途</label>
              <input type="text" value={formData.legalUsage}
                onChange={(e) => setFormData((p) => ({ ...p, legalUsage: e.target.value }))}
                className={`w-full ${field}`} />
            </div>
          </div>
        </section>
      ) : null}

      {/* 圖片 + 影片 */}
      <section>
        <h3 className={sectionTitle}>圖片與影片</h3>
        {mediaStatus ? (
          <p
            className={`mb-3 rounded-lg px-3 py-2 text-xs sm:text-sm ${
              mediaStatus.includes("已上傳") || mediaStatus.includes("影片已")
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {mediaStatus}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* 影片區 */}
          <div className="min-w-0 rounded-xl border border-zinc-200 p-3 sm:p-4">
            <p className="mb-2 text-xs font-medium text-zinc-800 sm:text-sm">物件影片</p>
            {formData.videoUrl ? (
              <div className="relative mb-3 overflow-hidden rounded-lg bg-zinc-900">
                <video src={formData.videoUrl} controls className="h-28 w-full object-cover sm:h-40" />
                <button type="button" onClick={() => setFormData((p) => ({ ...p, videoUrl: "" }))}
                  className="absolute right-2 top-2 rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                  移除
                </button>
              </div>
            ) : null}
            <input ref={videoInputRef} type="file" accept="video/*,.mp4,.mov,.webm,.m4v" className="hidden"
              onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, "video"); }} />
            <button type="button" disabled={uploadingVideo} onClick={() => videoInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-zinc-400 bg-zinc-50 px-2 py-2.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 sm:px-4 sm:py-3 sm:text-sm">
              {uploadingVideo ? "上傳中..." : formData.videoUrl ? "＋ 更換影片" : "＋ 選擇影片"}
            </button>
            <p className="mt-1 text-[10px] text-zinc-400 sm:text-xs">MP4、MOV、WEBM；正式站單檔建議 4MB 內</p>
            <div className="mt-2 sm:mt-3">
              <label className="mb-1 block text-[10px] font-medium text-zinc-600 sm:text-xs">或貼影片連結</label>
              <input type="text" value={formData.videoUrl}
                onChange={(e) => setFormData((p) => ({ ...p, videoUrl: e.target.value }))}
                className={`w-full ${field} text-xs sm:text-sm`} />
            </div>
          </div>

          {/* 圖片區 */}
          <div className="min-w-0 rounded-xl border border-zinc-200 p-3 sm:p-4">
            <p className="mb-2 text-xs font-medium text-zinc-800 sm:text-sm">物件圖片</p>
            {formData.images.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5 sm:gap-2">
                {formData.images.map((url) => (
                  <div key={url} className="group relative h-16 w-20 overflow-hidden rounded-lg border border-zinc-200 sm:h-20 sm:w-28">
                    <Image src={url} alt="物件圖片" fill className="object-cover" sizes="112px" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" onClick={() => setCover(url)}
                        className="rounded bg-white px-2 py-0.5 text-xs font-medium text-zinc-800">
                        {formData.coverImage === url ? "✓ 封面" : "設為封面"}
                      </button>
                      <button type="button" onClick={() => removeImage(url)}
                        className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">刪除</button>
                    </div>
                    {formData.coverImage === url ? (
                      <span className="absolute left-1 top-1 rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-white">封面</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
              onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, "image"); }} />
            <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-zinc-400 bg-zinc-50 px-2 py-2.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 sm:px-4 sm:py-3 sm:text-sm">
              {uploading ? "上傳中..." : "＋ 選擇圖片"}
            </button>
            <p className="mt-1 text-[10px] text-zinc-400 sm:text-xs">JPG、PNG、WEBP、HEIC</p>
          </div>
        </div>
      </section>

      {/* 起租日 / 押金 / 家具家電（橫排） */}
      <section className="space-y-4">
        {isRent ? (
          <>
            <FormRow label="起租日">
              <div className="relative w-44">
                <div
                  className={`flex items-center justify-between rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-base sm:py-2 sm:text-sm ${
                    availableUi.date ? "text-zinc-900" : "text-zinc-400"
                  }`}
                >
                  <span>{availableUi.date || "請選擇日期"}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-zinc-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="3.5" y="5" width="17" height="15" rx="2" />
                    <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
                  </svg>
                </div>
                <input
                  type="date"
                  aria-label="選擇起租日期"
                  value={availableUi.date}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {
                      // 瀏覽器不允許時，維持原生輸入框即可
                    }
                  }}
                  onChange={(e) =>
                    setAvailableUi(e.target.value ? { mode: "date", date: e.target.value } : { mode: "", date: "" })
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
              <CheckOption
                checked={availableUi.mode === "immediate"}
                onChange={(on) => setAvailableUi(on ? { mode: "immediate", date: "" } : { mode: "", date: "" })}
              >
                隨時可遷入
              </CheckOption>
            </FormRow>

            <FormRow label="押金">
              <CheckOption
                checked={depositUi.kind === "two"}
                onChange={(on) => setDepositUi(on ? { kind: "two", other: "" } : { kind: "", other: "" })}
              >
                2 個月
              </CheckOption>
              <CheckOption
                checked={depositUi.kind === "other"}
                onChange={(on) =>
                  setDepositUi((prev) => (on ? { kind: "other", other: prev.other } : { kind: "", other: "" }))
                }
              >
                其他
              </CheckOption>
              <input
                type="text"
                disabled={depositUi.kind !== "other"}
                placeholder="例：1.5 個月、面議"
                value={depositUi.other}
                onChange={(e) => setDepositUi({ kind: "other", other: e.target.value })}
                className={`${field} !w-44 disabled:bg-zinc-100`}
              />
            </FormRow>
          </>
        ) : null}

        <FormRow label="提供設備">
          {EQUIPMENT_ITEMS.map((item) => (
            <CheckOption
              key={item}
              checked={formData.equipmentItems.includes(item)}
              onChange={(on) =>
                setFormData((p) => ({
                  ...p,
                  equipmentItems: on ? [...p.equipmentItems, item] : p.equipmentItems.filter((x) => x !== item),
                }))
              }
            >
              {item}
            </CheckOption>
          ))}
        </FormRow>

        <FormRow label="提供家具">
          {FURNITURE_ITEMS.map((item) => (
            <CheckOption
              key={item}
              checked={formData.furnitureItems.includes(item)}
              onChange={(on) =>
                setFormData((p) => ({
                  ...p,
                  furnitureItems: on ? [...p.furnitureItems, item] : p.furnitureItems.filter((x) => x !== item),
                }))
              }
            >
              {item}
            </CheckOption>
          ))}
        </FormRow>
      </section>

      {/* 物件特色 */}
      <section>
        <h3 className={sectionTitle}>物件特色</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <label className={labelCompact}>特色 {i + 1}</label>
              <input
                type="text"
                value={formData.features[i] ?? ""}
                onChange={(e) => setFeatureAt(i, e.target.value)}
                className={`${fieldCompact} mt-1`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 特殊事項 */}
      <section>
        <h3 className={sectionTitle}>特殊事項</h3>
        <textarea
          value={formData.specialMatters}
          onChange={(e) => setFormData((p) => ({ ...p, specialMatters: e.target.value }))}
          rows={2}
          className={`w-full ${field}`}
        />
      </section>

      {/* 送出 */}
      <section className="space-y-3">
        <button type="submit" disabled={loading || uploading || uploadingVideo}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "儲存中..." : mode === "create" ? (isRent ? "建立租賃廣告" : "建立買賣廣告") : "儲存修改"}
        </button>
        {status ? (
          <p className={`text-sm ${status.includes("成功") ? "text-green-600" : "text-red-600"}`}>{status}</p>
        ) : null}
      </section>
    </form>
  );
}
