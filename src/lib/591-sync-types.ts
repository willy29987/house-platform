/** 591 租賃連動：任務與狀態型別（雲端／本機共用） */

export const SYNC_591_JOB_TYPES = [
  "publish",
  "unpublish",
  "update_fields",
  "update_photos",
  "refresh_status",
  /** 只抓 591 廣告到期日（後台即將到期提醒用） */
  "refresh_expiry",
] as const;

export type Sync591JobType = (typeof SYNC_591_JOB_TYPES)[number];

export const SYNC_591_JOB_STATUSES = [
  "queued",
  "running",
  "done",
  "failed",
  "needs_login",
] as const;

export type Sync591JobStatus = (typeof SYNC_591_JOB_STATUSES)[number];

export const SOURCE_591_STATUSES = [
  "unknown",
  "published",
  "unpublished",
  "not_found",
  "needs_login",
  "sync_error",
] as const;

export type Source591Status = (typeof SOURCE_591_STATUSES)[number];

export type Sync591RentSnapshot = {
  listingId: string;
  listingType: "RENT";
  title: string;
  city: string;
  district: string;
  address: string;
  community: string;
  propertyType: string;
  houseCondition: string;
  price: number;
  areaPing: number;
  rooms: number;
  livingRooms: number | null;
  bathrooms: number;
  balconies: number | null;
  floor: number | null;
  totalFloors: number | null;
  roomNumber: string;
  managementFee: number | null;
  securityDeposit: string;
  availableFrom: string;
  shortTermRent: string;
  serviceFee: string;
  petsAllowed: boolean | null;
  rentSubsidy: boolean | null;
  taxDeductible: boolean | null;
  canRegisterAddress: boolean | null;
  viewingMethod: string;
  parkingType: string | null;
  parkingRent: number | null;
  mrtLine: string | null;
  mrtStation: string | null;
  features: string[];
  specialMatters: string;
  furnitureItems: string[];
  equipmentItems: string[];
  contactName: string;
  contactPhone: string;
  coverImage: string | null;
  images: string[];
  videoUrl: string | null;
  source591Id: string | null;
  source591Url: string | null;
  isPublished: boolean;
};

export type Sync591Job = {
  id: string;
  type: Sync591JobType;
  listingId: string;
  status: Sync591JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  lastError: string | null;
  log: string[];
  /** 建立任務時的欄位快照 */
  snapshot: Sync591RentSnapshot;
  /** Agent 回寫：新建刊登後的 591 案號 */
  result591Id?: string | null;
  result591Url?: string | null;
  result591Status?: Source591Status | null;
  /** Agent 回寫：廣告到期日 YYYY-MM-DD */
  resultExpiresAt?: string | null;
};

export type Sync591JobStore = {
  jobs: Sync591Job[];
};

export type Sync591AgentConfig = {
  /** 明文只在產生當下顯示一次；此處存 hash */
  tokenHash: string | null;
  tokenHint: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  agentLabel: string | null;
};
