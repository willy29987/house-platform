/** 服務費（佣金）成交紀錄。先存瀏覽器本機，確認流程後再接資料庫。 */
export type CommissionRecord = {
  id: string;
  /** 成交 / 收款日期 YYYY-MM-DD */
  date: string;
  /** 物件案名 */
  title: string;
  listingType: "RENT" | "SALE" | "OTHER";
  /** 承辦業務 */
  operator: string;
  /** 客戶 / 屋主 */
  client: string;
  /** 成交金額（租金或售價） */
  dealAmount: number;
  /** 服務費（佣金）金額 */
  commission: number;
  /** 是否已收款 */
  received: boolean;
  note: string;
  createdAt: string;
  /** 來源刊登 id（成交按鈕帶入，方便防重與日後接 DB） */
  listingId?: string;
};

export const COMMISSION_STORAGE_KEY = "house-platform:commission-stats:v1";

export const commissionTypeLabel: Record<CommissionRecord["listingType"], string> = {
  RENT: "租賃",
  SALE: "買賣",
  OTHER: "其他",
};

export const commissionTypeBadgeCls: Record<CommissionRecord["listingType"], string> = {
  RENT: "bg-sky-100 text-sky-700",
  SALE: "bg-violet-100 text-violet-700",
  OTHER: "bg-zinc-100 text-zinc-600",
};

export function commissionTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function commissionNewId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatCommissionNtd(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;
}

export function emptyCommissionRecord(): CommissionRecord {
  return {
    id: commissionNewId(),
    date: commissionTodayStr(),
    title: "",
    listingType: "RENT",
    operator: "",
    client: "",
    dealAmount: 0,
    commission: 0,
    received: true,
    note: "",
    createdAt: new Date().toISOString(),
  };
}

export function loadCommissionRecordsLocal(): CommissionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMMISSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommissionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistCommissionRecordsLocal(records: CommissionRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMMISSION_STORAGE_KEY, JSON.stringify(records));
}

export function loadCommissionRecords(): CommissionRecord[] {
  return loadCommissionRecordsLocal();
}

export function saveCommissionRecords(records: CommissionRecord[]): void {
  persistCommissionRecordsLocal(records);
  if (typeof window === "undefined") return;
  void import("@/lib/admin-cloud-sync-client").then(({ schedulePushCloudPayload }) => {
    void import("@/lib/admin-cloud-data-keys").then(({ ADMIN_CLOUD_DATA_KEYS }) => {
      schedulePushCloudPayload(ADMIN_CLOUD_DATA_KEYS.commissionRecords, records);
    });
  });
}

export function appendCommissionRecord(record: CommissionRecord): CommissionRecord[] {
  const records = loadCommissionRecords();
  const next = [...records, record];
  saveCommissionRecords(next);
  return next;
}

export function hasCommissionForListing(listingId: string): boolean {
  return loadCommissionRecords().some((r) => r.listingId === listingId);
}

/** 依物件服務費約定試算佣金初值（租賃）；買賣預設 0，由業務手填或費率換算。 */
export function suggestCommissionAmount(
  dealAmount: number,
  serviceFeeText: string | null | undefined,
  listingType: "RENT" | "SALE" | "OTHER" = "RENT",
): number {
  if (dealAmount <= 0) return 0;
  if (listingType === "SALE") return 0;

  const t = (serviceFeeText ?? "").trim();
  if (!t || t === "無") return 0;
  if (t === "正常") return Math.round(dealAmount);
  if (t === "半個月") return Math.round(dealAmount / 2);

  const digits = t.replace(/[^\d.]/g, "");
  const n = Number(digits);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return 0;
}

export type CommissionListingDraftSource = {
  id: string;
  title: string;
  listingType: "RENT" | "SALE";
  price: number;
  serviceFee?: string | null;
  createdByUsername?: string | null;
  contactName?: string | null;
  city: string;
  district: string;
  address?: string;
  community?: string | null;
};

export function commissionDraftFromListing(listing: CommissionListingDraftSource): CommissionRecord {
  const dealAmount = listing.price ?? 0;
  const listingType = listing.listingType;
  const addressLine = `${listing.city}${listing.district}${listing.address ?? ""}`.trim();
  const community = listing.community?.trim();
  const noteParts = [
    community ? `社區：${community}` : null,
    addressLine ? `地址：${addressLine}` : null,
    `刊登 #${listing.id}`,
    listing.serviceFee?.trim() ? `約定服務費：${listing.serviceFee.trim()}` : null,
  ].filter(Boolean);

  return {
    id: commissionNewId(),
    date: commissionTodayStr(),
    title: listing.title.trim(),
    listingType,
    operator: listing.createdByUsername?.trim() ?? "",
    client: listing.contactName?.trim() ?? "",
    dealAmount,
    commission: suggestCommissionAmount(dealAmount, listing.serviceFee, listingType),
    received: true,
    note: noteParts.join("\n"),
    createdAt: new Date().toISOString(),
    listingId: listing.id,
  };
}
