export const ADMIN_CLOUD_DATA_KEYS = {
  ownerTracking: "owner_tracking",
  ownerTrackingListingChecks: "owner_tracking_listing_checks",
  commissionRecords: "commission_records",
  tenantManager: "tenant_manager",
  lineRentalCases: "line_rental_cases",
  lineGuestSessions: "line_guest_sessions",
  lineGuestWatchCriteria: "line_guest_watch_criteria",
  lineGuestProfile: "line_guest_profile",
  lineGuestPushQueue: "line_guest_push_queue",
  lineRuntimeSecrets: "line_runtime_secrets",
  lineConversations: "line_conversations",
  lineGuestRichMenus: "line_guest_rich_menus",
  adminWebPushVapid: "admin_web_push_vapid",
  adminWebPushSubscriptions: "admin_web_push_subscriptions",
} as const;

export type AdminCloudDataKey = (typeof ADMIN_CLOUD_DATA_KEYS)[keyof typeof ADMIN_CLOUD_DATA_KEYS];

const ALLOWED = new Set<string>(Object.values(ADMIN_CLOUD_DATA_KEYS));

export function parseAdminCloudDataKey(raw: string): AdminCloudDataKey | null {
  return ALLOWED.has(raw) ? (raw as AdminCloudDataKey) : null;
}
