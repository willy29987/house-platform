export const ADMIN_CLOUD_DATA_KEYS = {
  ownerTracking: "owner_tracking",
  commissionRecords: "commission_records",
  tenantManager: "tenant_manager",
} as const;

export type AdminCloudDataKey = (typeof ADMIN_CLOUD_DATA_KEYS)[keyof typeof ADMIN_CLOUD_DATA_KEYS];

const ALLOWED = new Set<string>(Object.values(ADMIN_CLOUD_DATA_KEYS));

export function parseAdminCloudDataKey(raw: string): AdminCloudDataKey | null {
  return ALLOWED.has(raw) ? (raw as AdminCloudDataKey) : null;
}
