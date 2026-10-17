"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  appendOwnerCase,
  OWNER_TRACKING_STATUS_OPTIONS,
  loadOwnerTrackingStore,
  type OwnerTrackingStatus,
  ownerCaseToInput,
  saveOwnerTrackingStore,
  updateOwnerCase,
  type OwnerCaseInput,
} from "@/lib/owner-tracking-preview";
import {
  CHOICE_OTHER,
  inferChoice,
  emptyLayoutUi,
  inferManagementFee,
  inferParkingFromStored,
  inferParkingPrice,
  parkingPriceToStored,
  inferPets,
  inferRentSubsidy,
  layoutUiToStored,
  managementFeeToStored,
  parseLayoutStored,
  choiceToStored,
  type LayoutUi,
  parkingUiToStored,
  PARKING_CUSTOM,
  petsToStored,
  rentSubsidyToStored,
  SERVICE_FEE_CHOICES,
  type ChoiceUi,
  type ManagementFeeUi,
  type ParkingPriceUi,
  type ParkingUi,
  type PetsUi,
  type RentSubsidyUi,
} from "@/lib/owner-tracking-form-ui";
import {
  LEGACY_PARKING_TYPES,
  PARKING_TYPE_LABELS,
  PARKING_TYPE_OPTIONS,
} from "@/lib/parking-type-label";
import { PROPERTY_TYPE_OPTIONS, propertyTypeLabel } from "@/lib/property-type-label";
import { TAIWAN_REGIONS } from "@/lib/taiwan-regions";

type Props = {
  currentUsername: string;
  mode?: "create" | "edit";
  caseId?: string;
};

const emptyForm = (): OwnerCaseInput => ({
  city: "",
  district: "",
  address: "",
  floor: "",
  totalFloors: "",
  propertyType: "ELEVATOR_BUILDING",
  community: "",
  ownerName: "",
  phone: "",
  listingUrl: "",
  rent: "",
  layout: "",
  areaPing: "",
  managementFee: "",
  otherFees: "",
  parking: "",
  parkingNumber: "",
  parkingPrice: "",
  pets: "",
  rentSubsidy: "",
  taxFiling: "",
  householdRegistration: "",
  serviceFee: "",
  specialMatters: "",
  caseNote: "",
});

function FormField({
  label,
  span = 1,
  children,
}: {
  label: string;
  span?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : "sm:col-span-1"}>
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </div>
  );
}

export function OwnerTrackingNewForm({ currentUsername, mode = "create", caseId }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(caseId);
  const [form, setForm] = useState<OwnerCaseInput>(emptyForm);
  const [propertyTypeCustom, setPropertyTypeCustom] = useState(false);
  const [hydrated, setHydrated] = useState(!isEdit);
  const [parkingUi, setParkingUi] = useState<ParkingUi>({ select: "", custom: "" });
  const [petsUi, setPetsUi] = useState<PetsUi>("");
  const [taxFilingUi, setTaxFilingUi] = useState<PetsUi>("");
  const [householdUi, setHouseholdUi] = useState<PetsUi>("");
  const [rentSubsidyUi, setRentSubsidyUi] = useState<RentSubsidyUi>("");
  const [serviceFeeUi, setServiceFeeUi] = useState<ChoiceUi>({ select: "", other: "" });
  const [managementFeeUi, setManagementFeeUi] = useState<ManagementFeeUi>({
    mode: "included",
    amount: "",
  });
  const [parkingPriceUi, setParkingPriceUi] = useState<ParkingPriceUi>({
    mode: "included",
    amount: "",
  });
  const [layoutUi, setLayoutUi] = useState<LayoutUi>(emptyLayoutUi());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialStatus, setInitialStatus] = useState<OwnerTrackingStatus>("持續聯繫");

  const field = "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm";
  const selectCompact =
    "w-full min-w-0 rounded-lg border border-zinc-300 bg-white py-2 pl-1.5 pr-5 text-xs leading-snug";
  const hasParking = Boolean(parkingUi.select);
  const parkingExtraDisabled = !hasParking;
  const selectedRegion = TAIWAN_REGIONS.find((r) => r.city === form.city);

  useEffect(() => {
    if (!isEdit || !caseId) return;
    const store = loadOwnerTrackingStore();
    const found = store.cases.find((c) => c.id === caseId);
    if (!found) {
      setError("找不到此案件");
      setHydrated(true);
      return;
    }
    const synced = syncOwnerTrackingFormUiFromStored(ownerCaseToInput(found));
    setForm(synced.form);
    setParkingUi(synced.parkingUi);
    setPetsUi(synced.petsUi);
    setTaxFilingUi(synced.taxFilingUi);
    setHouseholdUi(synced.householdUi);
    setRentSubsidyUi(synced.rentSubsidyUi);
    setServiceFeeUi(synced.serviceFeeUi);
    setManagementFeeUi(synced.managementFeeUi);
    setParkingPriceUi(synced.parkingPriceUi);
    setLayoutUi(synced.layoutUi);
    const knownType = (PROPERTY_TYPE_OPTIONS as readonly string[]).includes(found.propertyType);
    setPropertyTypeCustom(!knownType);
    setHydrated(true);
  }, [isEdit, caseId]);

  function setField<K extends keyof OwnerCaseInput>(key: K, value: OwnerCaseInput[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function buildPayload(): OwnerCaseInput {
    return {
      ...form,
      parking: parkingUiToStored(parkingUi),
      pets: petsToStored(petsUi),
      taxFiling: petsToStored(taxFilingUi),
      householdRegistration: petsToStored(householdUi),
      rentSubsidy: rentSubsidyToStored(rentSubsidyUi),
      serviceFee: choiceToStored(serviceFeeUi),
      managementFee: managementFeeToStored(managementFeeUi),
      parkingPrice: parkingUi.select ? parkingPriceToStored(parkingPriceUi) : "",
      layout: layoutUiToStored(layoutUi),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (
      !payload.city.trim() ||
      !payload.district.trim() ||
      !payload.address.trim() ||
      !payload.ownerName.trim() ||
      !payload.phone.trim()
    ) {
      setError("請至少填寫縣市、行政區、地址、姓名與電話");
      return;
    }
    if (parkingUi.select === PARKING_CUSTOM && !parkingUi.custom.trim()) {
      setError("請填寫自訂車位型式");
      return;
    }
    if (serviceFeeUi.select === CHOICE_OTHER && !serviceFeeUi.other.trim()) {
      setError("請填寫服務費自訂內容");
      return;
    }
    if (managementFeeUi.mode === "separate" && !managementFeeUi.amount.trim()) {
      setError("請填寫另計的管理費金額");
      return;
    }
    if (parkingUi.select && parkingPriceUi.mode === "separate" && !parkingPriceUi.amount.trim()) {
      setError("請填寫另計的車位價格");
      return;
    }

    setSubmitting(true);
    const store = loadOwnerTrackingStore();
    if (isEdit && caseId) {
      const next = updateOwnerCase(store, caseId, payload);
      if (!next) {
        setError("找不到此案件");
        setSubmitting(false);
        return;
      }
      saveOwnerTrackingStore(next);
      router.push(`/admin/owner-tracking/${caseId}`);
      return;
    }
    const { store: next, caseId: newCaseId } = appendOwnerCase(
      store,
      payload,
      currentUsername,
      initialStatus,
    );
    saveOwnerTrackingStore(next);
    router.push(`/admin/owner-tracking/${newCaseId}`);
  }

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">載入表單…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
            <label className="block w-full min-w-0 sm:w-[5.75rem] sm:shrink-0">
              <span className="mb-1 block text-xs font-medium text-zinc-600">縣市</span>
              <select
                value={form.city}
                onChange={(e) => {
                  setField("city", e.target.value);
                  setField("district", "");
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
              <span className="mb-1 block text-xs font-medium text-zinc-600">行政區</span>
              <select
                value={form.district}
                onChange={(e) => setField("district", e.target.value)}
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
              <span className="mb-1 block text-xs font-medium text-zinc-600">地址</span>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                className={`${field} h-[42px] py-0`}
              />
            </label>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
            <label className="block w-full min-w-0 sm:w-[7.25rem] sm:shrink-0">
              <span className="mb-1 flex items-center justify-between gap-1 text-xs font-medium text-zinc-600">
                <span>物件類別</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!propertyTypeCustom) {
                      setPropertyTypeCustom(true);
                      setField("propertyType", "");
                      setField("community", "");
                    } else {
                      setPropertyTypeCustom(false);
                      setField("propertyType", "ELEVATOR_BUILDING");
                    }
                  }}
                  className="shrink-0 text-[10px] font-normal text-[#1e3a8a] hover:underline sm:text-[11px]"
                >
                  {propertyTypeCustom ? "改選清單" : "自填"}
                </button>
              </span>
              {propertyTypeCustom ? (
                <input
                  type="text"
                  value={form.propertyType}
                  onChange={(e) => setField("propertyType", e.target.value)}
                  className={`${selectCompact} h-[42px] px-2 text-sm`}
                />
              ) : (
                <select
                  value={form.propertyType}
                  onChange={(e) => {
                    const next = e.target.value;
                    setField("propertyType", next);
                    if (!(["ELEVATOR_BUILDING", "OFFICE", "SHOP"] as string[]).includes(next)) {
                      setField("community", "");
                    }
                  }}
                  className={`${selectCompact} h-[42px] px-2 text-xs`}
                  title={
                    (PROPERTY_TYPE_OPTIONS as readonly string[]).includes(form.propertyType)
                      ? propertyTypeLabel(form.propertyType as (typeof PROPERTY_TYPE_OPTIONS)[number])
                      : form.propertyType
                  }
                >
                  {PROPERTY_TYPE_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {propertyTypeLabel(code)}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="block w-full min-w-0 sm:w-[10.5rem] sm:shrink-0">
              <span className="mb-1 block text-xs font-medium text-zinc-600">社區</span>
              <input
                type="text"
                value={form.community}
                onChange={(e) => setField("community", e.target.value)}
                className={`${field} h-[42px] py-0`}
              />
            </label>
            <div className="hidden min-w-[1.25rem] flex-1 sm:block" aria-hidden />
            <label className="block w-[calc(50%-0.375rem)] min-w-0 sm:w-[3.25rem] sm:shrink-0">
              <span className="mb-1 block text-xs font-medium text-zinc-600">樓層</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.floor}
                onChange={(e) => setField("floor", e.target.value)}
                className={`${field} h-[42px] px-1.5 py-0 text-center`}
              />
            </label>
            <label className="block w-[calc(50%-0.375rem)] min-w-0 sm:w-[3.25rem] sm:shrink-0">
              <span className="mb-1 block text-xs font-medium text-zinc-600">總樓層</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.totalFloors}
                onChange={(e) => setField("totalFloors", e.target.value)}
                className={`${field} h-[42px] px-1.5 py-0 text-center`}
              />
            </label>
          </div>
        </div>

        <FormField label="使用坪數">
          <input type="text" value={form.areaPing} onChange={(e) => setField("areaPing", e.target.value)} className={field} />
        </FormField>
        <FormField label="格局">
          <div className="flex h-[42px] min-w-0 items-center gap-1.5 sm:gap-2">
            {(
              [
                ["rooms", "房"],
                ["living", "廳"],
                ["bath", "衛"],
                ["balcony", "陽台"],
              ] as const
            ).map(([key, suffix]) => (
              <div
                key={key}
                className={`relative min-w-0 ${key === "balcony" ? "flex-[1.15]" : "flex-1"}`}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={layoutUi[key]}
                  onChange={(e) => setLayoutUi((prev) => ({ ...prev, [key]: e.target.value }))}
                  className={`h-[42px] w-full min-w-0 rounded-lg border bg-white py-2 pl-2 text-sm ${
                    key === "balcony" ? "pr-10" : "pr-7"
                  } ${
                    key === "rooms" ? "border-orange-400" : "border-zinc-300"
                  }`}
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
                checked={layoutUi.openLayout}
                onChange={(e) => setLayoutUi((prev) => ({ ...prev, openLayout: e.target.checked }))}
                className="size-4 shrink-0 rounded border-zinc-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
              />
              開放式格局
            </label>
          </div>
        </FormField>

        <div className="sm:col-span-2 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
          <FormField label="租金">
            <input type="text" value={form.rent} onChange={(e) => setField("rent", e.target.value)} className={field} />
          </FormField>
          <FormField label="管理費">
            <div className="flex h-[42px] items-stretch overflow-hidden rounded-lg border border-zinc-300 bg-white">
              <select
                value={managementFeeUi.mode}
                onChange={(e) => {
                  const mode = e.target.value as ManagementFeeUi["mode"];
                  setManagementFeeUi((prev) => ({
                    mode,
                    amount: mode === "included" ? "" : prev.amount,
                  }));
                }}
                className={`h-full shrink-0 border-0 bg-transparent py-2 pl-3 pr-7 text-sm ${
                  managementFeeUi.mode === "separate" ? "max-w-[5.25rem]" : "min-w-0 flex-1"
                }`}
              >
                <option value="included">含在租金裡</option>
                <option value="separate">另計</option>
              </select>
              {managementFeeUi.mode === "separate" ? (
                <>
                  <div className="w-px shrink-0 self-stretch bg-zinc-200" aria-hidden />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={managementFeeUi.amount}
                    onChange={(e) => setManagementFeeUi((prev) => ({ ...prev, amount: e.target.value }))}
                    className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm focus:outline-none focus:ring-0"
                    aria-label="管理費金額"
                  />
                </>
              ) : null}
            </div>
          </FormField>
          <FormField label="其他費用">
            <input
              type="text"
              value={form.otherFees}
              onChange={(e) => setField("otherFees", e.target.value)}
              placeholder="自行填寫"
              className={field}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
          <FormField label="車位">
            <select
              value={parkingUi.select}
              onChange={(e) => {
                const select = e.target.value;
                setParkingUi((prev) => ({ ...prev, select }));
                if (!select) {
                  setParkingPriceUi({ mode: "included", amount: "" });
                }
              }}
              className={field}
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
                value={parkingUi.custom}
                onChange={(e) => setParkingUi((prev) => ({ ...prev, custom: e.target.value }))}
                className={`${field} mt-2`}
                placeholder="自訂車位型式"
                aria-label="自訂車位型式"
              />
            ) : null}
          </FormField>
          <FormField label="車位價格">
            <div
              className={`flex h-[42px] items-stretch overflow-hidden rounded-lg border border-zinc-300 ${
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
          </FormField>
          <FormField label="車位編號">
            <input
              type="text"
              value={form.parkingNumber}
              disabled={parkingExtraDisabled}
              onChange={(e) => setField("parkingNumber", e.target.value)}
              className={`${field} disabled:bg-zinc-100 disabled:text-zinc-400`}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-3">
          <FormField label="租補">
            <select
              value={rentSubsidyUi}
              onChange={(e) => setRentSubsidyUi(e.target.value as RentSubsidyUi)}
              className={field}
            >
              <option value="">未填寫</option>
              <option value="eligible">可申請</option>
              <option value="ineligible">不可申請</option>
            </select>
          </FormField>
          <FormField label="報稅">
            <select
              value={taxFilingUi}
              onChange={(e) => setTaxFilingUi(e.target.value as PetsUi)}
              className={field}
            >
              <option value="">未填寫</option>
              <option value="yes">可</option>
              <option value="no">不可</option>
            </select>
          </FormField>
          <FormField label="戶籍">
            <select
              value={householdUi}
              onChange={(e) => setHouseholdUi(e.target.value as PetsUi)}
              className={field}
            >
              <option value="">未填寫</option>
              <option value="yes">可</option>
              <option value="no">不可</option>
            </select>
          </FormField>
        </div>

        <div className="sm:col-span-2 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 sm:items-start">
          <FormField label="服務費">
            <select
              value={serviceFeeUi.select}
              onChange={(e) =>
                setServiceFeeUi((prev) => ({
                  select: e.target.value,
                  other: e.target.value === CHOICE_OTHER ? prev.other : "",
                }))
              }
              className={field}
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
                value={serviceFeeUi.other}
                onChange={(e) => setServiceFeeUi({ select: CHOICE_OTHER, other: e.target.value })}
                className={`${field} mt-2`}
                placeholder="自訂服務費"
                aria-label="服務費自訂"
              />
            ) : null}
          </FormField>
          <FormField label="寵物">
            <select value={petsUi} onChange={(e) => setPetsUi(e.target.value as PetsUi)} className={field}>
              <option value="">未填寫</option>
              <option value="yes">可</option>
              <option value="no">不可</option>
            </select>
          </FormField>
        </div>

        <FormField label="特別事項" span={2}>
          <textarea
            value={form.specialMatters}
            onChange={(e) => setField("specialMatters", e.target.value)}
            rows={2}
            className={field}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:col-span-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,7fr)] sm:items-end">
          <FormField label="姓名">
            <input
              type="text"
              value={form.ownerName}
              onChange={(e) => setField("ownerName", e.target.value)}
              className={field}
            />
          </FormField>
          <FormField label="電話">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className={field}
            />
          </FormField>
          <FormField label="網址">
            <input
              type="url"
              value={form.listingUrl}
              onChange={(e) => setField("listingUrl", e.target.value)}
              className={field}
              placeholder="https://"
            />
          </FormField>
        </div>

        {isEdit ? (
          <FormField label="備註" span={2}>
            <textarea
              value={form.caseNote}
              onChange={(e) => setField("caseNote", e.target.value)}
              rows={3}
              className={field}
            />
          </FormField>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

      {isEdit ? (
        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            disabled={submitting}
            className="min-w-[10rem] rounded-lg bg-[#0b2545] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3a8a] disabled:opacity-60"
          >
            儲存修改
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-sm font-bold text-zinc-900">記錄本次追蹤</p>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">狀態</span>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as OwnerTrackingStatus)}
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
                value={form.caseNote}
                onChange={(e) => setField("caseNote", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="h-[42px] rounded-lg bg-[#0b2545] px-6 text-sm font-semibold text-white hover:bg-[#1e3a8a] disabled:opacity-60 sm:h-auto sm:py-2.5"
            >
              建立案件
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function syncOwnerTrackingFormUiFromStored(stored: OwnerCaseInput) {
  return {
    form: stored,
    parkingUi: inferParkingFromStored(stored.parking),
    petsUi: inferPets(stored.pets),
    taxFilingUi: inferPets(stored.taxFiling),
    householdUi: inferPets(stored.householdRegistration),
    rentSubsidyUi: inferRentSubsidy(stored.rentSubsidy),
    serviceFeeUi: inferChoice(stored.serviceFee, SERVICE_FEE_CHOICES),
    managementFeeUi: inferManagementFee(stored.managementFee),
    parkingPriceUi: inferParkingPrice(stored.parkingPrice),
    layoutUi: parseLayoutStored(stored.layout),
  };
}
