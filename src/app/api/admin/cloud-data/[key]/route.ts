import { NextResponse } from "next/server";
import { ADMIN_CLOUD_DATA_KEYS, parseAdminCloudDataKey } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { requireAdminSession } from "@/lib/admin-auth";
import { normalizeOwnerTrackingStore } from "@/lib/owner-tracking-preview";
import { purgeCompanySyncContentUpdateFollowUps } from "@/lib/owner-tracking-staff-stats";
import type { OwnerTrackingStore } from "@/lib/owner-tracking-preview";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const { key: rawKey } = await context.params;
  const key = parseAdminCloudDataKey(rawKey);
  if (!key) {
    return NextResponse.json({ ok: false, message: "未知的資料類型" }, { status: 400 });
  }

  let payload = await readAdminCloudPayload(key);
  // 打開後台時清掉自抓「內容更新」灌的空備註電訪，今日數字立刻正確
  if (key === ADMIN_CLOUD_DATA_KEYS.ownerTracking && payload) {
    const store = normalizeOwnerTrackingStore(payload as OwnerTrackingStore);
    const purged = purgeCompanySyncContentUpdateFollowUps(store);
    if (purged.removed > 0) {
      await writeAdminCloudPayload(key, purged.store, { replace: true });
      payload = purged.store;
    }
  }
  return NextResponse.json({ ok: true, payload });
}

export async function PUT(request: Request, context: RouteContext) {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const { key: rawKey } = await context.params;
  const key = parseAdminCloudDataKey(rawKey);
  if (!key) {
    return NextResponse.json({ ok: false, message: "未知的資料類型" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON 格式錯誤" }, { status: 400 });
  }

  const payload =
    body !== null && typeof body === "object" && "payload" in body
      ? (body as { payload: unknown }).payload
      : body;
  const replace =
    body !== null &&
    typeof body === "object" &&
    "replace" in body &&
    Boolean((body as { replace?: unknown }).replace);

  await writeAdminCloudPayload(key, payload, { replace });
  return NextResponse.json({ ok: true });
}
