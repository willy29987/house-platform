import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { runBanqiao591SuiteSync } from "@/lib/listing-591-banqiao-sync";
import { sendGuestRecommendationDigest } from "@/lib/line-guest-watch-notify";
import {
  DEFAULT_OPS_SCHEDULE,
  normalizeOpsSchedule,
  readOpsSchedule,
  SYNC_INTERVAL_OPTIONS,
  taipeiParts,
  writeOpsSchedule,
} from "@/lib/ops-schedule";

export const runtime = "nodejs";
export const maxDuration = 300;

const patchSchema = z.object({
  syncEnabled: z.boolean().optional(),
  syncIntervalHours: z.number().int().optional(),
  pushEnabled: z.boolean().optional(),
  pushHour: z.number().int().min(0).max(23).optional(),
  pushMinute: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(45)]).optional(),
  runSyncNow: z.boolean().optional(),
  runPushNow: z.boolean().optional(),
});

export async function GET() {
  const authError = await requireSuperAdmin();
  if (authError) return authError;
  const schedule = await readOpsSchedule();
  return NextResponse.json({
    ok: true,
    schedule,
    defaults: DEFAULT_OPS_SCHEDULE,
    syncIntervalOptions: SYNC_INTERVAL_OPTIONS,
  });
}

export async function PUT(request: Request) {
  const authError = await requireSuperAdmin();
  if (authError) return authError;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "參數無效" }, { status: 400 });
  }

  if (
    body.syncIntervalHours != null &&
    !SYNC_INTERVAL_OPTIONS.includes(body.syncIntervalHours as (typeof SYNC_INTERVAL_OPTIONS)[number])
  ) {
    return NextResponse.json(
      { ok: false, message: `抓取間隔僅支援：${SYNC_INTERVAL_OPTIONS.join("／")} 小時` },
      { status: 400 },
    );
  }

  const current = await readOpsSchedule();
  let schedule = normalizeOpsSchedule({
    ...current,
    ...(body.syncEnabled != null ? { syncEnabled: body.syncEnabled } : {}),
    ...(body.syncIntervalHours != null ? { syncIntervalHours: body.syncIntervalHours } : {}),
    ...(body.pushEnabled != null ? { pushEnabled: body.pushEnabled } : {}),
    ...(body.pushHour != null ? { pushHour: body.pushHour } : {}),
    ...(body.pushMinute != null ? { pushMinute: body.pushMinute } : {}),
  });
  schedule = await writeOpsSchedule(schedule);

  const ran: { sync?: unknown; push?: unknown } = {};
  const nowIso = new Date().toISOString();
  const { dayKey } = taipeiParts();

  if (body.runSyncNow) {
    try {
      ran.sync = await runBanqiao591SuiteSync();
      schedule = await writeOpsSchedule({ ...schedule, lastSyncAt: nowIso });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error instanceof Error ? error.message : "立即同步失敗",
          schedule,
        },
        { status: 500 },
      );
    }
  }

  if (body.runPushNow) {
    try {
      ran.push = await sendGuestRecommendationDigest();
      schedule = await writeOpsSchedule({
        ...schedule,
        lastPushAt: nowIso,
        lastPushDay: dayKey,
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error instanceof Error ? error.message : "立即推播失敗",
          schedule,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, schedule, ran });
}
