import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin-auth";
import {
  enqueue591ExpiryScan,
  enqueueRentSyncAfterChange,
  listJobsForListing,
  readSync591AgentConfig,
  readSync591Jobs,
  requeueJob,
  rotateSync591AgentToken,
} from "@/lib/591-sync-jobs";
import {
  filterExpiring591Listings,
  getDaysUntil591Expiry,
  sortExpiring591ListingsSoonestFirst,
  SOURCE_591_EXPIRY_WARN_DAYS,
} from "@/lib/591-expiry";
import { getAdminListings } from "@/lib/listings";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireSuperAdmin();
  if (authError) return authError;
  const url = new URL(request.url);
  const listingId = url.searchParams.get("listingId")?.trim();
  const agent = await readSync591AgentConfig();
  if (listingId) {
    const jobs = await listJobsForListing(listingId, 30);
    return NextResponse.json({
      ok: true,
      agent: {
        hasToken: Boolean(agent.tokenHash),
        tokenHint: agent.tokenHint,
        lastHeartbeatAt: agent.lastHeartbeatAt,
        agentLabel: agent.agentLabel,
      },
      jobs,
    });
  }
  const store = await readSync591Jobs();
  const admin = await getCurrentAdmin();
  const listings = await getAdminListings();
  const expiring = sortExpiring591ListingsSoonestFirst(
    filterExpiring591Listings(listings, {
      currentUsername: admin?.username ?? "",
      isSuperAdmin: admin?.role === "SUPER_ADMIN",
      withinDays: SOURCE_591_EXPIRY_WARN_DAYS,
    }),
  ).map((l) => ({
    id: l.id,
    title: l.title,
    source591Id: l.source591Id,
    source591ExpiresAt: l.source591ExpiresAt,
    daysLeft: getDaysUntil591Expiry(l.source591ExpiresAt),
  }));
  return NextResponse.json({
    ok: true,
    agent: {
      hasToken: Boolean(agent.tokenHash),
      tokenHint: agent.tokenHint,
      lastHeartbeatAt: agent.lastHeartbeatAt,
      agentLabel: agent.agentLabel,
      createdAt: agent.createdAt,
    },
    queued: store.jobs.filter((j) => j.status === "queued").length,
    running: store.jobs.filter((j) => j.status === "running").length,
    recent: store.jobs.slice(0, 40),
    expiring,
    expiryWarnDays: SOURCE_591_EXPIRY_WARN_DAYS,
  });
}

const postSchema = z.object({
  action: z.enum([
    "rotate_token",
    "retry_listing",
    "refresh_status",
    "refresh_expiry",
    "scan_expiry",
    "retry_job",
  ]),
  listingId: z.string().optional(),
  jobId: z.string().optional(),
  agentLabel: z.string().optional(),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  const authError = await requireSuperAdmin();
  if (authError) return authError;

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "參數無效" }, { status: 400 });
  }

  if (body.action === "rotate_token") {
    const { token, config } = await rotateSync591AgentToken(body.agentLabel);
    return NextResponse.json({
      ok: true,
      token,
      hint: config.tokenHint,
      message: "請立刻複製 token 到本機 Agent 設定；之後無法再查看完整內容。",
    });
  }

  if (body.action === "retry_job") {
    if (!body.jobId) return NextResponse.json({ ok: false, message: "缺少 jobId" }, { status: 400 });
    const job = await requeueJob(body.jobId);
    if (!job) return NextResponse.json({ ok: false, message: "找不到任務" }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  }

  if (body.action === "scan_expiry") {
    const { jobs, scannedCandidates } = await enqueue591ExpiryScan({
      force: body.force ?? true,
      limit: 80,
      staleHours: 1,
    });
    return NextResponse.json({
      ok: true,
      jobs,
      enqueued: jobs.length,
      scannedCandidates,
      message: `已排程 ${jobs.length} 筆到期日檢查（候選 ${scannedCandidates}）`,
    });
  }

  if (!body.listingId) {
    return NextResponse.json({ ok: false, message: "缺少 listingId" }, { status: 400 });
  }

  if (body.action === "refresh_status") {
    const { jobs } = await enqueueRentSyncAfterChange({
      listingId: body.listingId,
      kind: "status_only",
    });
    return NextResponse.json({ ok: true, jobs });
  }

  if (body.action === "refresh_expiry") {
    const { jobs } = await enqueueRentSyncAfterChange({
      listingId: body.listingId,
      kind: "expiry_only",
    });
    return NextResponse.json({ ok: true, jobs });
  }

  const { jobs } = await enqueueRentSyncAfterChange({
    listingId: body.listingId,
    kind: "retry_all",
  });
  return NextResponse.json({ ok: true, jobs });
}
