/** 屋主追蹤預覽版：型別、狀態選項、localStorage（正式版可改 Postgres）。 */

import { formatOwnerCaseAddress, parseTaiwanAddress } from "@/lib/taiwan-address";
import { normalizeNextContactDate } from "@/lib/owner-tracking-next-contact";

export { formatOwnerCaseAddress } from "@/lib/taiwan-address";

export const OWNER_TRACKING_STATUS_OPTIONS = [
  "持續聯繫",
  "只可帶看",
  "可上591",
  "屋主已出租",
] as const;

/** 舊追蹤狀態 → 現行選項（讀取 localStorage／雲端／URL 篩選時套用） */
export function normalizeFollowUpStatus(status: string): OwnerTrackingStatus {
  const legacy: Record<string, OwnerTrackingStatus> = {
    "已接／再聯絡": "持續聯繫",
    已約看: "只可帶看",
    考慮中: "持續聯繫",
    暫停追蹤: "持續聯繫",
    未接: "持續聯繫",
    同意委託: "可上591",
    已出租結案: "屋主已出租",
    "無效／重複": "屋主已出租",
  };
  const t = status.trim();
  if (legacy[t]) return legacy[t];
  if ((OWNER_TRACKING_STATUS_OPTIONS as readonly string[]).includes(t)) {
    return t as OwnerTrackingStatus;
  }
  return "持續聯繫";
}

export type OwnerTrackingStatus = (typeof OWNER_TRACKING_STATUS_OPTIONS)[number];

export type OwnerCasePreview = {
  id: string;
  assignee: string;
  createdAt: string;
  /** 路址（不含縣市、行政區） */
  address: string;
  city: string;
  district: string;
  floor: string;
  totalFloors: string;
  /** 物件類別（PropertyType 代碼或自填文字） */
  propertyType: string;
  /** 社區名稱（電梯大樓／辦公／店面） */
  community: string;
  /** 姓名 */
  ownerName: string;
  phone: string;
  /** 網址（自行填寫） */
  listingUrl: string;
  rent: string;
  layout: string;
  areaPing: string;
  managementFee: string;
  /** 其他費用（自行填寫） */
  otherFees: string;
  parking: string;
  /** 車位編號 */
  parkingNumber: string;
  /** 車位價格：含在租金內或另計金額 */
  parkingPrice: string;
  pets: string;
  rentSubsidy: string;
  /** 報稅（可／不可） */
  taxFiling: string;
  /** 戶籍（可／不可） */
  householdRegistration: string;
  serviceFee: string;
  /** 特別事項 */
  specialMatters: string;
  /** 案件備註 */
  caseNote: string;
  /** 下次應聯繫日（Asia/Taipei YYYY-MM-DD；空 = 未設定） */
  nextContactDate: string;
  /** 591 下架等情況下預計可再開發日（YYYY-MM-DD） */
  expectedReleaseDate: string;
};

export type OwnerCaseInput = Omit<OwnerCasePreview, "id" | "assignee" | "createdAt">;

export type OwnerFollowUpPreview = {
  id: string;
  caseId: string;
  status: OwnerTrackingStatus;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type OwnerTrackingStore = {
  cases: OwnerCasePreview[];
  followUps: OwnerFollowUpPreview[];
};

export const emptyOwnerTrackingStore: OwnerTrackingStore = { cases: [], followUps: [] };

export const OWNER_TRACKING_STORAGE_KEY = "house-platform:owner-tracking-preview:v4";

/** 舊版 localStorage 欄位相容 */
export function normalizeCase(raw: Record<string, unknown>, fallbackAssignee = "—"): OwnerCasePreview {
  const id = String(raw.id ?? newId("case"));
  let city = String(raw.city ?? "");
  let district = String(raw.district ?? "");
  let address = String(raw.address ?? "");
  if (!city.trim() && !district.trim() && address.trim()) {
    const parsed = parseTaiwanAddress(address);
    city = parsed.city;
    district = parsed.district;
    address = parsed.address;
  }
  return {
    id,
    assignee: String(raw.assignee ?? fallbackAssignee),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    address,
    city,
    district,
    floor: String(raw.floor ?? ""),
    totalFloors: String(raw.totalFloors ?? ""),
    propertyType: String(raw.propertyType ?? ""),
    community: String(raw.community ?? ""),
    ownerName: String(raw.ownerName ?? ""),
    phone: String(raw.phone ?? ""),
    listingUrl: String(raw.listingUrl ?? raw.listingTitle ?? ""),
    rent: String(raw.rent ?? ""),
    layout: String(raw.layout ?? ""),
    areaPing: String(raw.areaPing ?? ""),
    managementFee: String(raw.managementFee ?? ""),
    otherFees: String(raw.otherFees ?? ""),
    parking: String(raw.parking ?? ""),
    parkingNumber: String(raw.parkingNumber ?? ""),
    parkingPrice: String(raw.parkingPrice ?? ""),
    pets: String(raw.pets ?? ""),
    rentSubsidy: String(raw.rentSubsidy ?? ""),
    taxFiling: String(raw.taxFiling ?? ""),
    householdRegistration: String(raw.householdRegistration ?? ""),
    serviceFee: String(raw.serviceFee ?? ""),
    specialMatters: String(raw.specialMatters ?? ""),
    caseNote: String(raw.caseNote ?? ""),
    nextContactDate: normalizeNextContactDate(String(raw.nextContactDate ?? "")),
    expectedReleaseDate: normalizeNextContactDate(String(raw.expectedReleaseDate ?? "")),
  };
}

function stripLegacyCreateCaseNote(note: string): string {
  return note.trim() === "建立案件" ? "" : note;
}

/** 雲端／合併資料進列表前一律正規化，避免 null 欄位導致 .trim() 崩潰 */
export function normalizeOwnerTrackingStore(store: OwnerTrackingStore): OwnerTrackingStore {
  return {
    cases: (store.cases ?? []).map((c) => {
      const base = normalizeCase(c as unknown as Record<string, unknown>);
      return { ...base, caseNote: stripLegacyCreateCaseNote(base.caseNote) };
    }),
    followUps: (store.followUps ?? []).map((f) => ({
      id: String(f.id ?? newId("fu")),
      caseId: String(f.caseId ?? ""),
      status: normalizeFollowUpStatus(String(f.status ?? "")),
      note: stripLegacyCreateCaseNote(String(f.note ?? "")),
      createdBy: String(f.createdBy ?? ""),
      createdAt: String(f.createdAt ?? new Date().toISOString()),
    })),
  };
}

function parseOwnerTrackingStoreRaw(raw: string | null, withInitialFollowUps = true): OwnerTrackingStore {
  if (!raw) return emptyOwnerTrackingStore;
  try {
    const parsed = JSON.parse(raw) as OwnerTrackingStore;
    const store: OwnerTrackingStore = {
      cases: (parsed.cases ?? []).map((c) => normalizeCase(c as unknown as Record<string, unknown>)),
      followUps: (parsed.followUps ?? []).map((f) => ({
        ...f,
        status: normalizeFollowUpStatus(String(f.status)),
      })),
    };
    return withInitialFollowUps ? ensureInitialFollowUps(store) : store;
  } catch {
    return emptyOwnerTrackingStore;
  }
}

/** 只讀本機快取（不觸發雲端上傳） */
export function loadOwnerTrackingStoreLocal(): OwnerTrackingStore {
  if (typeof window === "undefined") return emptyOwnerTrackingStore;
  const raw = window.localStorage.getItem(OWNER_TRACKING_STORAGE_KEY);
  return parseOwnerTrackingStoreRaw(raw, true);
}

let ownerTrackingLocalPersistedAt = 0;

/** 本機剛寫入屋主追蹤後的時間戳，用於避免雲端 refresh 蓋掉刪除等操作 */
export function getOwnerTrackingLocalPersistedAt(): number {
  return ownerTrackingLocalPersistedAt;
}

export function persistOwnerTrackingStoreLocal(store: OwnerTrackingStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OWNER_TRACKING_STORAGE_KEY, JSON.stringify(store));
  ownerTrackingLocalPersistedAt = Date.now();
}

export function loadOwnerTrackingStore(): OwnerTrackingStore {
  if (typeof window === "undefined") {
    return emptyOwnerTrackingStore;
  }
  const raw = window.localStorage.getItem(OWNER_TRACKING_STORAGE_KEY);
  const base = parseOwnerTrackingStoreRaw(raw, false);
  const withInitial = ensureInitialFollowUps(base);
  if (withInitial.followUps.length !== base.followUps.length) {
    saveOwnerTrackingStore(withInitial);
  }
  return withInitial;
}

/** 舊案件若無任何追蹤，補一筆「建立案件」以對齊聯絡次數與時間軸。 */
function ensureInitialFollowUps(store: OwnerTrackingStore): OwnerTrackingStore {
  const followUps = [...store.followUps];
  let added = false;
  for (const c of store.cases) {
    if (followUps.some((f) => f.caseId === c.id)) continue;
    added = true;
    followUps.push({
      id: newId("fu"),
      caseId: c.id,
      status: "持續聯繫",
      note: c.caseNote.trim(),
      createdBy: c.assignee,
      createdAt: c.createdAt,
    });
  }
  if (!added) return store;
  return { ...store, followUps };
}

export function saveOwnerTrackingStore(store: OwnerTrackingStore) {
  persistOwnerTrackingStoreLocal(store);
  if (typeof window === "undefined") return;
  void import("@/lib/admin-cloud-sync-client").then(
    ({ invalidateOwnerTrackingHydrateCache, pushOwnerTrackingFromLocalNow }) => {
      invalidateOwnerTrackingHydrateCache();
      pushOwnerTrackingFromLocalNow();
    },
  );
}

/** 合併雲端寫入：以 id 聯集，避免舊版 localStorage 覆蓋整庫 */
export function mergeOwnerTrackingStores(
  base: OwnerTrackingStore,
  overlay: OwnerTrackingStore,
): OwnerTrackingStore {
  const casesById = new Map(base.cases.map((c) => [c.id, c]));
  for (const c of overlay.cases) {
    casesById.set(c.id, c);
  }
  const followById = new Map(base.followUps.map((f) => [f.id, f]));
  for (const f of overlay.followUps) {
    followById.set(f.id, f);
  }
  return normalizeOwnerTrackingStore({
    cases: [...casesById.values()],
    followUps: [...followById.values()],
  });
}

/** 業務可看自己的案件；未分配（—）為共用池；最高管理員看全部 */
export function canViewOwnerTrackingCase(
  ownerCase: Pick<OwnerCasePreview, "assignee">,
  opts: { currentUsername: string; isSuperAdmin: boolean },
): boolean {
  if (opts.isSuperAdmin) return true;
  const a = ownerCase.assignee.trim();
  if (!a || a === "—") return true;
  return a === opts.currentUsername.trim();
}

export function lastFollowUp(
  store: OwnerTrackingStore,
  caseId: string,
): OwnerFollowUpPreview | null {
  const list = store.followUps.filter((f) => f.caseId === caseId);
  if (!list.length) return null;
  return list.sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  })[0]!;
}

export function formatFollowUpWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function statusBadgeClass(status: string): string {
  const normalized = normalizeFollowUpStatus(status);
  switch (normalized) {
    case "可上591":
    case "屋主已出租":
      return "bg-emerald-100 text-emerald-800";
    case "持續聯繫":
      return "bg-violet-100 text-violet-800";
    case "只可帶看":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-violet-100 text-violet-800";
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function appendOwnerCase(
  store: OwnerTrackingStore,
  input: OwnerCaseInput,
  assignee: string,
  initialStatus: OwnerTrackingStatus = "持續聯繫",
): { store: OwnerTrackingStore; caseId: string } {
  const caseId = newId("case");
  const createdAt = new Date().toISOString();
  const trimmed = trimOwnerCaseInput(input);
  const newCase: OwnerCasePreview = {
    id: caseId,
    assignee,
    createdAt,
    ...trimmed,
    nextContactDate: normalizeNextContactDate(trimmed.nextContactDate),
  };

  const initialFollowUp: OwnerFollowUpPreview = {
    id: newId("fu"),
    caseId,
    status: initialStatus,
    note: input.caseNote.trim(),
    createdBy: assignee,
    createdAt,
  };

  return {
    caseId,
    store: {
      cases: [...store.cases, newCase],
      followUps: [...store.followUps, initialFollowUp],
    },
  };
}

/** 列表「聯絡次數」= 含建檔在內的追蹤紀錄筆數。 */
export function ownerCaseContactCount(store: OwnerTrackingStore, caseId: string): number {
  return store.followUps.filter((f) => f.caseId === caseId).length;
}

export function deleteOwnerFollowUp(store: OwnerTrackingStore, followUpId: string): OwnerTrackingStore {
  return {
    ...store,
    followUps: store.followUps.filter((f) => f.id !== followUpId),
  };
}

export function deleteOwnerCase(store: OwnerTrackingStore, caseId: string): OwnerTrackingStore {
  return {
    cases: store.cases.filter((c) => c.id !== caseId),
    followUps: store.followUps.filter((f) => f.caseId !== caseId),
  };
}

/** 內網示範案（建立時標 【示範】或 R001 測試資料） */
export function isOwnerTrackingDemoCase(c: Pick<OwnerCasePreview, "ownerName" | "caseNote" | "assignee">): boolean {
  const name = c.ownerName.trim();
  const note = c.caseNote.trim();
  if (name.includes("示範") || note.includes("示範")) return true;
  if (name === "0先生") return true;
  return false;
}

export function ownerCaseToInput(c: OwnerCasePreview): OwnerCaseInput {
  return {
    address: c.address,
    city: c.city,
    district: c.district,
    floor: c.floor,
    totalFloors: c.totalFloors,
    propertyType: c.propertyType,
    community: c.community,
    ownerName: c.ownerName,
    phone: c.phone,
    listingUrl: c.listingUrl,
    rent: c.rent,
    layout: c.layout,
    areaPing: c.areaPing,
    managementFee: c.managementFee,
    otherFees: c.otherFees,
    parking: c.parking,
    parkingNumber: c.parkingNumber,
    parkingPrice: c.parkingPrice,
    pets: c.pets,
    rentSubsidy: c.rentSubsidy,
    taxFiling: c.taxFiling,
    householdRegistration: c.householdRegistration,
    serviceFee: c.serviceFee,
    specialMatters: c.specialMatters,
    caseNote: c.caseNote,
    nextContactDate: c.nextContactDate,
    expectedReleaseDate: c.expectedReleaseDate,
  };
}

export function patchOwnerCaseNextContact(
  store: OwnerTrackingStore,
  caseId: string,
  nextContactDate: string,
): OwnerTrackingStore {
  const ymd = normalizeNextContactDate(nextContactDate);
  return {
    ...store,
    cases: store.cases.map((c) => (c.id === caseId ? { ...c, nextContactDate: ymd } : c)),
  };
}

function trimOwnerCaseInput(input: OwnerCaseInput): OwnerCaseInput {
  return {
    address: input.address.trim(),
    city: input.city.trim(),
    district: input.district.trim(),
    floor: input.floor.trim(),
    totalFloors: input.totalFloors.trim(),
    propertyType: input.propertyType.trim(),
    community: input.community.trim(),
    ownerName: input.ownerName.trim(),
    phone: input.phone.trim(),
    listingUrl: input.listingUrl.trim(),
    rent: input.rent.trim(),
    layout: input.layout.trim(),
    areaPing: input.areaPing.trim(),
    managementFee: input.managementFee.trim(),
    otherFees: input.otherFees.trim(),
    parking: input.parking.trim(),
    parkingNumber: input.parkingNumber.trim(),
    parkingPrice: input.parkingPrice.trim(),
    pets: input.pets.trim(),
    rentSubsidy: input.rentSubsidy.trim(),
    taxFiling: input.taxFiling.trim(),
    householdRegistration: input.householdRegistration.trim(),
    serviceFee: input.serviceFee.trim(),
    specialMatters: input.specialMatters.trim(),
    caseNote: input.caseNote.trim(),
    nextContactDate: normalizeNextContactDate(input.nextContactDate),
    expectedReleaseDate: normalizeNextContactDate(input.expectedReleaseDate),
  };
}

export function updateOwnerCase(
  store: OwnerTrackingStore,
  caseId: string,
  input: OwnerCaseInput,
): OwnerTrackingStore | null {
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return null;
  const prev = store.cases[idx]!;
  const trimmed = trimOwnerCaseInput(input);
  const cases = [...store.cases];
  cases[idx] = {
    ...prev,
    ...trimmed,
    nextContactDate: normalizeNextContactDate(trimmed.nextContactDate),
  };
  return { ...store, cases };
}

export const OWNER_CASE_FIELD_LABELS: { key: keyof OwnerCaseInput; label: string }[] = [
  { key: "city", label: "縣市" },
  { key: "district", label: "行政區" },
  { key: "address", label: "地址" },
  { key: "floor", label: "樓層" },
  { key: "totalFloors", label: "總樓層" },
  { key: "propertyType", label: "物件類別" },
  { key: "community", label: "社區名稱" },
  { key: "ownerName", label: "姓名" },
  { key: "phone", label: "電話" },
  { key: "listingUrl", label: "網址" },
  { key: "rent", label: "租金" },
  { key: "layout", label: "格局" },
  { key: "areaPing", label: "使用坪數" },
  { key: "managementFee", label: "管理費" },
  { key: "otherFees", label: "其他費用" },
  { key: "parking", label: "車位" },
  { key: "parkingNumber", label: "車位編號" },
  { key: "parkingPrice", label: "車位價格" },
  { key: "rentSubsidy", label: "租補" },
  { key: "taxFiling", label: "報稅" },
  { key: "householdRegistration", label: "戶籍" },
  { key: "serviceFee", label: "服務費" },
  { key: "pets", label: "寵物" },
  { key: "specialMatters", label: "特別事項" },
  { key: "caseNote", label: "備註" },
];
