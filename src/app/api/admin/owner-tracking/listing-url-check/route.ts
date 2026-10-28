import { NextResponse } from "next/server";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { getCurrentAdmin, requireAdminSession } from "@/lib/admin-auth";
import { apply591RemovedToOwnerStore } from "@/lib/owner-tracking-release";
import { normalizeOwnerTrackingStore } from "@/lib/owner-tracking-preview";
import { check591ListingUrlBatch, is591ListingUrl } from "@/lib/listing-591-check";
import {
  mergeListing591CheckResults,
  normalizeOwnerTrackingListingChecksStore,
  type OwnerTrackingListingChecksStore,
} from "@/lib/owner-tracking-listing-checks";

const MAX_ITEMS = 30;

type CheckItem = { caseId: string; url: string };

function parseItems(body: unknown): CheckItem[] {
  if (!body || typeof body !== "object") return [];
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: CheckItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const caseId = String((raw as CheckItem).caseId ?? "").trim();
    const url = String((raw as CheckItem).url ?? "").trim();
    if (!caseId || !url || !is591ListingUrl(url)) continue;
    out.push({ caseId, url });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export async function POST(request: Request) {
  const guard = await requireAdminSession();
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 格式錯誤" }, { status: 400 });
  }

  const items = parseItems(body);
  if (items.length === 0) {
    return NextResponse.json({ ok: true, results: {} as Record<string, unknown> });
  }

  const results = await check591ListingUrlBatch(items, { concurrency: 4 });

  let cloudPersisted = true;
  try {
    const existingRaw = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTrackingListingChecks);
    const existing = normalizeOwnerTrackingListingChecksStore(existingRaw);
    const merged = mergeListing591CheckResults(existing, results);
    await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTrackingListingChecks, merged);
  } catch (error) {
    cloudPersisted = false;
    console.error("[listing-url-check] cloud persist failed:", error);
  }

  let ownerTrackingUpdated = false;
  const removedCaseIds = Object.entries(results)
    .filter(([, entry]) => entry.status === "removed")
    .map(([caseId]) => caseId);

  if (removedCaseIds.length > 0) {
    try {
      const current = await getCurrentAdmin();
      const ownerRaw = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
      const ownerStore = normalizeOwnerTrackingStore(
        (ownerRaw as Parameters<typeof normalizeOwnerTrackingStore>[0]) ?? { cases: [], followUps: [] },
      );
      const { store: nextOwner, changed, updatedCaseIds } = apply591RemovedToOwnerStore(
        ownerStore,
        removedCaseIds,
        { createdBy: current?.username ?? "system" },
      );
      if (changed) {
        await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking, nextOwner);
        ownerTrackingUpdated = true;
      }
      if (updatedCaseIds.length > 0) {
        console.info("[listing-url-check] 591 下架已寫入釋出追蹤:", updatedCaseIds.join(", "));
      }
    } catch (error) {
      console.error("[listing-url-check] owner tracking auto-invalid failed:", error);
    }
  }

  return NextResponse.json({ ok: true, results, cloudPersisted, ownerTrackingUpdated });
}
