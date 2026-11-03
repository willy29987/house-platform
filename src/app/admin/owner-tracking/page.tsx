import { redirect } from "next/navigation";
import { OwnerTrackingList } from "@/components/owner-tracking-list";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import {
  listStaffUsernamesForAssigneeFilter,
  loadAdminStaffLabelMap,
} from "@/lib/admin-staff-labels";
import {
  emptyOwnerTrackingStore,
  normalizeOwnerTrackingStore,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";

export default async function AdminOwnerTrackingPage() {
  const current = await getCurrentAdmin();
  if (!current) redirect("/admin/login");

  const [staffUsernames, staffLabels, cloudPayload] = await Promise.all([
    listStaffUsernamesForAssigneeFilter(),
    loadAdminStaffLabelMap(),
    readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking),
  ]);

  const initialStore: OwnerTrackingStore = cloudPayload
    ? normalizeOwnerTrackingStore(cloudPayload as OwnerTrackingStore)
    : emptyOwnerTrackingStore;

  return (
    <main className="mx-auto w-full">
      <OwnerTrackingList
        currentUsername={current.username}
        isSuperAdmin={current.role === "SUPER_ADMIN"}
        staffUsernames={staffUsernames}
        staffLabels={staffLabels}
        initialStore={initialStore}
      />
    </main>
  );
}

export const dynamic = "force-dynamic";
