"use client";

import Image from "next/image";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CityDistrictSelector } from "@/components/city-district-selector";

export type AdminListingFormData = {
  title: string;
  features: string[];
  city: string;
  district: string;
  address: string;
  community: string;
  listingType: "RENT" | "SALE";
  propertyType: "APARTMENT" | "HOUSE" | "STUDIO" | "OFFICE" | "SHOP";
  price: string;
  areaPing: string;
  areaMain: string;
  areaAncillary: string;
  areaParkingSpace: string;
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
  furnitureProvided: "" | "yes" | "no";
  applianceProvided: "" | "yes" | "no";
  shortTermRent: string;
  serviceFee: string;
  registrationUse: string;
  securityDeposit: string;
  availableFrom: string;
  householdsPerFloor: string;
  isPublished: boolean;
};

type AdminListingFormProps = {
  mode: "create" | "edit";
  submitUrl: string;
  initialData: AdminListingFormData;
  lockedListingType?: "RENT" | "SALE";
};

const PARKING_TYPES = [
  { value: "", label: "無" },
  { value: "FLAT_RAMP", label: "坡道平面" },
  { value: "MECHANICAL_LIFT", label: "機械升降" },
  { value: "MECHANICAL_FLAT", label: "機械平面" },
  { value: "RAMP_MECHANICAL", label: "坡道機械" },
  { value: "FRONT_DOOR", label: "門口可停車" },
  { value: "OTHER", label: "其他" },
];

const ORIENTATIONS = ["", "東", "西", "南", "北", "東南", "東北", "西南", "西北"];
const DECOR_LEVELS = ["", "毛胚", "簡裝", "中等裝潢", "精裝", "豪華裝潢"];
const USAGE_ZONINGS = ["", "住宅區", "商業區", "住商混合", "工業區", "其他"];

const MRT_LINES = [
  "",
  "台北捷運 文湖線",
  "台北捷運 淡水信義線",
  "台北捷運 松山新店線",
  "台北捷運 中和新蘆線",
  "台北捷運 板南線",
  "台北捷運 環狀線",
  "淡海輕軌",
  "安坑輕軌",
  "桃園捷運 機場線",
  "台中捷運 綠線",
  "高雄捷運 紅線",
  "高雄捷運 橘線",
  "高雄輕軌 環狀輕軌",
  "其他",
];

function triState(value: "" | "yes" | "no"): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export function AdminListingForm({ mode, submitUrl, initialData, lockedListingType }: AdminListingFormProps) {
  const [formData, setFormData] = useState(initialData);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const idCardInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isRent = formData.listingType === "RENT";
  const isSale = formData.listingType === "SALE";

  async function uploadFiles(files: FileList, kind: "image" | "video") {
    if (!files.length) return;
    if (kind === "image") setUploading(true); else setUploadingVideo(true);
    const fd = new FormData();
    for (const file of files) fd.append("files", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const result = (await res.json()) as { ok: boolean; urls?: string[]; message?: string };
    if (result.ok && result.urls) {
      if (kind === "image") {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...result.urls!],
          coverImage: prev.coverImage || result.urls![0] || "",
        }));
      } else {
        setFormData((prev) => ({ ...prev, videoUrl: result.urls![0] ?? prev.videoUrl }));
      }
    } else {
      setStatus(result.message ?? "上傳失敗");
    }
    if (kind === "image") setUploading(false); else setUploadingVideo(false);
  }

  async function uploadIdCard(file: File) {
    setUploadingIdCard(true);
    const fd = new FormData();
    fd.append("files", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const result = (await res.json()) as { ok: boolean; urls?: string[]; message?: string };
    if (result.ok && result.urls && result.urls[0]) {
      setFormData((prev) => ({ ...prev, ownerIdCardUrl: result.urls![0] }));
    } else {
      setStatus(result.message ?? "身分證上傳失敗");
    }
    setUploadingIdCard(false);
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

    const cleanFeatures = formData.features.map((f) => f.trim()).filter(Boolean);

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
      areaParkingSpace: formData.areaParkingSpace ? Number(formData.areaParkingSpace) : null,
      parkingSpaceInfo: formData.parkingSpaceInfo || null,
      parkingRent: isRent && formData.parkingRent ? Number(formData.parkingRent) : null,
      parkingType: formData.parkingType || null,
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
      ownerIdCardUrl: formData.ownerIdCardUrl || null,
      furnitureProvided: triState(formData.furnitureProvided),
      applianceProvided: triState(formData.applianceProvided),
      shortTermRent: formData.shortTermRent || null,
      serviceFee: formData.serviceFee || null,
      registrationUse: formData.registrationUse || null,
      securityDeposit: formData.securityDeposit || null,
      availableFrom: formData.availableFrom || null,
      householdsPerFloor: formData.householdsPerFloor || null,
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
    if (mode === "create") {
      setTimeout(() => { router.push("/admin"); }, 500);
    }
  }

  const field = "rounded-lg border border-zinc-300 px-3 py-2 text-sm";
  const labelCls = "mb-1 block text-xs font-medium text-zinc-600";
  const sectionTitle = "mb-3 text-sm font-semibold text-zinc-900 border-l-4 border-zinc-900 pl-2";
  const typeBadgeCls = isRent
    ? "inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white"
    : "inline-block rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 類型提示 */}
      <div className="flex items-center gap-2">
        <span className={typeBadgeCls}>{isRent ? "租賃" : "買賣"}</span>
        <span className="text-xs text-zinc-500">
          {isRent ? "租賃物件上架表單（591 租屋格式）" : "買賣物件上架表單（591 售屋格式）"}
        </span>
      </div>

      {/* 基本資訊 */}
      <section>
        <h3 className={sectionTitle}>基本資訊</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>標題</label>
            <input required placeholder="物件標題" value={formData.title}
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
          <div>
            <label className={labelCls}>物件類別</label>
            <select value={formData.propertyType}
              onChange={(e) => setFormData((p) => ({
                ...p,
                propertyType: e.target.value as AdminListingFormData["propertyType"],
              }))}
              className={`w-full ${field}`}>
              <option value="APARTMENT">大樓</option>
              <option value="HOUSE">透天</option>
              <option value="STUDIO">套房</option>
              <option value="OFFICE">辦公</option>
              <option value="SHOP">店面</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>縣市 / 行政區</label>
            <CityDistrictSelector
              cityValue={formData.city}
              districtValue={formData.district}
              onCityChange={(city) => setFormData((p) => ({ ...p, city }))}
              onDistrictChange={(district) => setFormData((p) => ({ ...p, district }))} />
          </div>
          <div>
            <label className={labelCls}>地址（內部用，前台會遮蔽門牌）</label>
            <input required placeholder="詳細地址" value={formData.address}
              onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>社區 / 大樓名稱（選填）</label>
            <input placeholder="例：信義 A25" value={formData.community}
              onChange={(e) => setFormData((p) => ({ ...p, community: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
        </div>
      </section>

      {/* 價格與費用 */}
      <section>
        <h3 className={sectionTitle}>{isRent ? "租金與費用" : "售價與費用"}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>{isRent ? "月租（元）" : "總售價（萬元）"}</label>
            <input
              required
              type="number"
              min={isRent ? "1" : "0"}
              step={isRent ? "1" : "0.01"}
              placeholder={isRent ? "例：28000" : "例：1800 表示 1,800 萬"}
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
            <label className={labelCls}>管理費 / 月（元）</label>
            <input type="number" min="0" placeholder="選填" value={formData.managementFee}
              onChange={(e) => setFormData((p) => ({ ...p, managementFee: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          {isRent ? (
            <div>
              <label className={labelCls}>車位租金 / 月（元）</label>
              <input type="number" min="0" placeholder="選填" value={formData.parkingRent}
                onChange={(e) => setFormData((p) => ({ ...p, parkingRent: e.target.value }))}
                className={`w-full ${field}`} />
            </div>
          ) : (
            <div>
              <label className={labelCls}>單價 / 坪（萬元，系統自動計算）</label>
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

      {/* 格局與空間 */}
      <section>
        <h3 className={sectionTitle}>格局與空間</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>房</label>
            <input required type="number" min="0" value={formData.rooms}
              onChange={(e) => setFormData((p) => ({ ...p, rooms: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>廳</label>
            <input type="number" min="0" placeholder="選填" value={formData.livingRooms}
              onChange={(e) => setFormData((p) => ({ ...p, livingRooms: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>衛</label>
            <input required type="number" min="0" value={formData.bathrooms}
              onChange={(e) => setFormData((p) => ({ ...p, bathrooms: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>陽台</label>
            <input type="number" min="0" placeholder="選填" value={formData.balconies}
              onChange={(e) => setFormData((p) => ({ ...p, balconies: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>樓層</label>
            <input type="number" placeholder="選填" value={formData.floor}
              onChange={(e) => setFormData((p) => ({ ...p, floor: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>總樓層</label>
            <input type="number" placeholder="選填" value={formData.totalFloors}
              onChange={(e) => setFormData((p) => ({ ...p, totalFloors: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
        </div>
      </section>

      {/* 坪數明細 */}
      <section>
        <h3 className={sectionTitle}>坪數明細</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>權狀坪數</label>
            <input required type="number" min="0.1" step="0.01" value={formData.areaPing}
              onChange={(e) => setFormData((p) => ({ ...p, areaPing: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>主建物</label>
            <input type="number" min="0" step="0.01" placeholder="選填" value={formData.areaMain}
              onChange={(e) => setFormData((p) => ({ ...p, areaMain: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>附屬建物</label>
            <input type="number" min="0" step="0.01" placeholder="選填" value={formData.areaAncillary}
              onChange={(e) => setFormData((p) => ({ ...p, areaAncillary: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>車位坪數</label>
            <input type="number" min="0" step="0.01" placeholder="選填" value={formData.areaParkingSpace}
              onChange={(e) => setFormData((p) => ({ ...p, areaParkingSpace: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
        </div>
      </section>

      {/* 車位資訊 */}
      <section>
        <h3 className={sectionTitle}>車位資訊</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>車位型式</label>
            <select value={formData.parkingType}
              onChange={(e) => setFormData((p) => ({ ...p, parkingType: e.target.value }))}
              className={`w-full ${field}`}>
              {PARKING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>車位樓層/號碼（例：B3 75）</label>
            <input type="text" placeholder="例：B3 75" value={formData.parkingSpaceInfo}
              onChange={(e) => setFormData((p) => ({ ...p, parkingSpaceInfo: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          {isSale ? (
            <div className="sm:col-span-2">
              <label className={labelCls}>車位是否含於總價</label>
              <select value={formData.parkingIncluded}
                onChange={(e) => setFormData((p) => ({ ...p, parkingIncluded: e.target.value as "" | "yes" | "no" }))}
                className={`w-full ${field}`}>
                <option value="">未填寫</option>
                <option value="yes">含車位</option>
                <option value="no">不含（另計）</option>
              </select>
            </div>
          ) : null}
        </div>
      </section>

      {/* 鄰近捷運（選填） */}
      <section>
        <h3 className={sectionTitle}>鄰近捷運（選填）</h3>
        <p className="-mt-1 mb-3 text-xs text-zinc-500">
          若物件鄰近捷運站，可填寫此欄位。會顯示在外網物件卡片與詳情頁，方便客戶辨識交通。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>捷運線</label>
            <select value={formData.mrtLine}
              onChange={(e) => setFormData((p) => ({ ...p, mrtLine: e.target.value }))}
              className={`w-full ${field}`}>
              {MRT_LINES.map((l) => (
                <option key={l} value={l}>{l || "未填寫"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>捷運站</label>
            <input type="text" placeholder="例：內湖站、信義安和站" value={formData.mrtStation}
              onChange={(e) => setFormData((p) => ({ ...p, mrtStation: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
        </div>
      </section>

      {/* 租賃專用：條件 / 帶看 */}
      {isRent ? (
        <section>
          <h3 className={sectionTitle}>租賃條件與帶看</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["petsAllowed", "可養寵物"],
              ["taxDeductible", "可報稅"],
              ["rentSubsidy", "可租屋補助"],
              ["canRegisterAddress", "可入戶籍"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <select value={formData[key]}
                  onChange={(e) => setFormData((p) => ({ ...p, [key]: e.target.value as "" | "yes" | "no" }))}
                  className={`w-full ${field}`}>
                  <option value="">未填寫</option>
                  <option value="yes">可</option>
                  <option value="no">不可</option>
                </select>
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className={labelCls}>帶看方式</label>
              <select value={formData.viewingMethod}
                onChange={(e) => setFormData((p) => ({ ...p, viewingMethod: e.target.value as "" | "KEY" | "OWNER_APPOINTMENT" }))}
                className={`w-full ${field}`}>
                <option value="">未填寫</option>
                <option value="KEY">有鑰匙，隨時可帶看</option>
                <option value="OWNER_APPOINTMENT">需約屋主時間</option>
              </select>
            </div>
          </div>
        </section>
      ) : null}

      {/* 買賣專用：建物資訊 */}
      {isSale ? (
        <section>
          <h3 className={sectionTitle}>建物資訊</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>屋齡（年）</label>
              <input type="number" min="0" step="0.1" placeholder="例：8.5" value={formData.buildingAge}
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
              <label className={labelCls}>法定用途（例：住家用）</label>
              <input type="text" placeholder="選填" value={formData.legalUsage}
                onChange={(e) => setFormData((p) => ({ ...p, legalUsage: e.target.value }))}
                className={`w-full ${field}`} />
            </div>
          </div>
        </section>
      ) : null}

      {/* 屋主聯絡資訊（僅供內部使用，不會顯示在外網） */}
      <section>
        <h3 className={sectionTitle}>屋主聯絡資訊（內部）</h3>
        <p className="-mt-1 mb-3 text-xs text-zinc-500">
          此區所有欄位僅供內部建檔使用，<span className="font-semibold text-rose-600">不會</span>顯示在對外網頁。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>屋主姓名</label>
            <input required placeholder="例如：王先生" value={formData.contactName}
              onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
          <div>
            <label className={labelCls}>屋主電話</label>
            <input required placeholder="例如：0912-345-678" value={formData.contactPhone}
              onChange={(e) => setFormData((p) => ({ ...p, contactPhone: e.target.value }))}
              className={`w-full ${field}`} />
          </div>
        </div>

        {/* 身分證上傳（選填） */}
        <div className="mt-4">
          <label className={labelCls}>屋主身分證（選填）</label>
          <p className="mb-2 text-xs text-zinc-500">
            可上傳身分證正／反面照片或 PDF 掃描檔，檔案僅儲存在內部後台供建檔確認用。
          </p>
          {formData.ownerIdCardUrl ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              {/\.(pdf)$/i.test(formData.ownerIdCardUrl) ? (
                <a
                  href={formData.ownerIdCardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#2563eb] ring-1 ring-zinc-200 hover:bg-zinc-100"
                >
                  📄 檢視 PDF
                </a>
              ) : (
                <a
                  href={formData.ownerIdCardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Image
                    src={formData.ownerIdCardUrl}
                    alt="屋主身分證"
                    width={160}
                    height={100}
                    className="h-24 w-auto rounded-md border border-zinc-200 object-cover"
                  />
                </a>
              )}
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, ownerIdCardUrl: "" }))}
                className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                移除
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={idCardInputRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadIdCard(f);
                  if (idCardInputRef.current) idCardInputRef.current.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => idCardInputRef.current?.click()}
                disabled={uploadingIdCard}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {uploadingIdCard ? "上傳中..." : "選擇檔案"}
              </button>
              <span className="text-xs text-zinc-500">支援 JPG / PNG / PDF，大小建議 &lt; 10MB</span>
            </div>
          )}
        </div>
      </section>

      {/* 圖片 + 影片 */}
      <section>
        <h3 className={sectionTitle}>圖片與影片</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 圖片區 */}
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="mb-2 text-sm font-medium text-zinc-800">物件圖片（可多張）</p>
            {formData.images.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {formData.images.map((url) => (
                  <div key={url} className="group relative h-20 w-28 overflow-hidden rounded-lg border border-zinc-200">
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
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, "image"); }} />
            <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-zinc-400 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60">
              {uploading ? "上傳中..." : "＋ 點此選擇圖片（可多張）"}
            </button>
            <p className="mt-1 text-xs text-zinc-400">支援 JPG、PNG、WEBP</p>
          </div>

          {/* 影片區 */}
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="mb-2 text-sm font-medium text-zinc-800">物件影片（選填，僅一支）</p>
            {formData.videoUrl ? (
              <div className="relative mb-3 overflow-hidden rounded-lg bg-zinc-900">
                <video src={formData.videoUrl} controls className="h-40 w-full object-cover" />
                <button type="button" onClick={() => setFormData((p) => ({ ...p, videoUrl: "" }))}
                  className="absolute right-2 top-2 rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                  移除
                </button>
              </div>
            ) : null}
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
              onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, "video"); }} />
            <button type="button" disabled={uploadingVideo} onClick={() => videoInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-zinc-400 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60">
              {uploadingVideo ? "上傳中..." : formData.videoUrl ? "＋ 更換影片" : "＋ 點此選擇影片"}
            </button>
            <p className="mt-1 text-xs text-zinc-400">支援 MP4、WEBM，單檔 100MB 以內</p>
            <div className="mt-3">
              <label className={labelCls}>或貼上影片連結（YouTube / 既有 URL）</label>
              <input type="text" placeholder="https://..." value={formData.videoUrl}
                onChange={(e) => setFormData((p) => ({ ...p, videoUrl: e.target.value }))}
                className={`w-full ${field}`} />
            </div>
          </div>
        </div>
      </section>

      {/* 特色 */}
      <section>
        <h3 className={sectionTitle}>物件特色（6 格，填寫後會顯示於外網）</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <label className={labelCls}>特色 {i + 1}</label>
              <input type="text"
                placeholder={["例：鄰近捷運 5 分鐘", "例：高樓層景觀佳", "例：學區方正", "例：近商圈便利", "例：社區管理完善", "例：新裝潢可議"][i]}
                value={formData.features[i] ?? ""}
                onChange={(e) => setFeatureAt(i, e.target.value)}
                className={`w-full ${field}`} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className={sectionTitle}>業務補充欄位（內部）</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>家具提供</label>
            <select value={formData.furnitureProvided} onChange={(e) => setFormData((p) => ({ ...p, furnitureProvided: e.target.value as "" | "yes" | "no" }))} className={`w-full ${field}`}>
              <option value="">未填寫</option><option value="yes">有</option><option value="no">無</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>家電提供</label>
            <select value={formData.applianceProvided} onChange={(e) => setFormData((p) => ({ ...p, applianceProvided: e.target.value as "" | "yes" | "no" }))} className={`w-full ${field}`}>
              <option value="">未填寫</option><option value="yes">有</option><option value="no">無</option>
            </select>
          </div>
          <div><label className={labelCls}>一層幾戶</label><input value={formData.householdsPerFloor} onChange={(e) => setFormData((p) => ({ ...p, householdsPerFloor: e.target.value }))} className={`w-full ${field}`} /></div>
          <div><label className={labelCls}>能否短租</label><input value={formData.shortTermRent} onChange={(e) => setFormData((p) => ({ ...p, shortTermRent: e.target.value }))} placeholder="例：可短租 3 個月" className={`w-full ${field}`} /></div>
          <div><label className={labelCls}>服務費</label><input value={formData.serviceFee} onChange={(e) => setFormData((p) => ({ ...p, serviceFee: e.target.value }))} placeholder="例：半個月 / 無" className={`w-full ${field}`} /></div>
          <div><label className={labelCls}>使照登記</label><input value={formData.registrationUse} onChange={(e) => setFormData((p) => ({ ...p, registrationUse: e.target.value }))} className={`w-full ${field}`} /></div>
          <div><label className={labelCls}>押金</label><input value={formData.securityDeposit} onChange={(e) => setFormData((p) => ({ ...p, securityDeposit: e.target.value }))} className={`w-full ${field}`} /></div>
          <div><label className={labelCls}>起租日</label><input value={formData.availableFrom} onChange={(e) => setFormData((p) => ({ ...p, availableFrom: e.target.value }))} placeholder="例：可立即起租" className={`w-full ${field}`} /></div>
        </div>
      </section>

      {/* 上下架 + 送出 */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm">
          <input type="checkbox" checked={formData.isPublished}
            onChange={(e) => setFormData((p) => ({ ...p, isPublished: e.target.checked }))} />
          立即上架（取消勾選則先存草稿）
        </label>
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
