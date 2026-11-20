import { createHash, randomBytes, randomUUID } from "crypto";
import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { parseListingInternalMeta, toListingDescription } from "@/lib/listing-internal-meta";
import { prisma } from "@/lib/prisma";
import type {
  Source591Status,
  Sync591AgentConfig,
  Sync591Job,
  Sync591JobStore,
  Sync591JobType,
  Sync591RentSnapshot,
} from "@/lib/591-sync-types";

const MAX_JOBS = 400;

function emptyStore(): Sync591JobStore {
  return { jobs: [] };
}

function normalizeStore(raw: unknown): Sync591JobStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const jobs = Array.isArray((raw as Sync591JobStore).jobs) ? (raw as Sync591JobStore).jobs : [];
  return {
    jobs: jobs
      .filter((j) => j && typeof j === "object" && typeof (j as Sync591Job).id === "string")
      .slice(0, MAX_JOBS) as Sync591Job[],
  };
}

export async function readSync591Jobs(): Promise<Sync591JobStore> {
  return normalizeStore(await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.sync591Jobs));
}

async function writeSync591Jobs(store: Sync591JobStore) {
  const next = normalizeStore(store);
  next.jobs = next.jobs
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_JOBS);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.sync591Jobs, next, { replace: true });
  return next;
}

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function readSync591AgentConfig(): Promise<Sync591AgentConfig> {
  const raw = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.sync591AgentConfig);
  if (!raw || typeof raw !== "object") {
    return {
      tokenHash: null,
      tokenHint: null,
      createdAt: null,
      lastSeenAt: null,
      lastHeartbeatAt: null,
      agentLabel: null,
    };
  }
  const o = raw as Partial<Sync591AgentConfig>;
  return {
    tokenHash: typeof o.tokenHash === "string" ? o.tokenHash : null,
    tokenHint: typeof o.tokenHint === "string" ? o.tokenHint : null,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : null,
    lastSeenAt: typeof o.lastSeenAt === "string" ? o.lastSeenAt : null,
    lastHeartbeatAt: typeof o.lastHeartbeatAt === "string" ? o.lastHeartbeatAt : null,
    agentLabel: typeof o.agentLabel === "string" ? o.agentLabel : null,
  };
}

export async function writeSync591AgentConfig(cfg: Sync591AgentConfig) {
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.sync591AgentConfig, cfg, { replace: true });
  return cfg;
}

/** 產生新 token（只回傳一次明文） */
export async function rotateSync591AgentToken(agentLabel?: string) {
  const token = `hp591_${randomBytes(24).toString("hex")}`;
  const now = new Date().toISOString();
  const cfg = await writeSync591AgentConfig({
    tokenHash: hashAgentToken(token),
    tokenHint: `${token.slice(0, 10)}…${token.slice(-4)}`,
    createdAt: now,
    lastSeenAt: null,
    lastHeartbeatAt: null,
    agentLabel: agentLabel?.trim() || "office-agent",
  });
  return { token, config: cfg };
}

export async function assertSync591AgentToken(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return false;
  const cfg = await readSync591AgentConfig();
  if (!cfg.tokenHash) return false;
  return hashAgentToken(token) === cfg.tokenHash;
}

export async function touchSync591AgentHeartbeat(label?: string) {
  const cfg = await readSync591AgentConfig();
  const now = new Date().toISOString();
  await writeSync591AgentConfig({
    ...cfg,
    lastSeenAt: now,
    lastHeartbeatAt: now,
    agentLabel: label?.trim() || cfg.agentLabel,
  });
}

export async function buildRentSnapshot(listingId: string): Promise<Sync591RentSnapshot | null> {
  const row = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!row || row.listingType !== "RENT") return null;
  const meta = parseListingInternalMeta(row.description);
  return {
    listingId: row.id,
    listingType: "RENT",
    title: row.title,
    city: row.city,
    district: row.district,
    address: row.address,
    community: row.community ?? "",
    propertyType: row.propertyType,
    houseCondition: meta.houseCondition ?? "",
    price: row.price,
    areaPing: row.areaPing,
    rooms: row.rooms,
    livingRooms: row.livingRooms,
    bathrooms: row.bathrooms,
    balconies: row.balconies,
    floor: row.floor,
    totalFloors: row.totalFloors,
    roomNumber: meta.roomNumber ?? "",
    managementFee: row.managementFee,
    securityDeposit: meta.securityDeposit ?? "",
    availableFrom: meta.availableFrom ?? "",
    shortTermRent: meta.shortTermRent ?? "",
    serviceFee: meta.serviceFee ?? "",
    petsAllowed: row.petsAllowed,
    rentSubsidy: row.rentSubsidy,
    taxDeductible: row.taxDeductible,
    canRegisterAddress: row.canRegisterAddress,
    viewingMethod: row.viewingMethod ?? "",
    parkingType: row.parkingType,
    parkingRent: row.parkingRent,
    mrtLine: row.mrtLine,
    mrtStation: row.mrtStation,
    features: row.features ?? [],
    specialMatters: meta.specialMatters ?? "",
    furnitureItems: meta.furnitureItems ?? [],
    equipmentItems: meta.equipmentItems ?? [],
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    coverImage: row.coverImage,
    images: row.images ?? [],
    videoUrl: row.videoUrl,
    source591Id: row.source591Id,
    source591Url: row.source591Url,
    isPublished: row.isPublished,
  };
}

export async function enqueueSync591Job(input: {
  listingId: string;
  type: Sync591JobType;
  /** 若已有 snapshot 可直接傳，否則自動建立 */
  snapshot?: Sync591RentSnapshot;
}): Promise<Sync591Job | null> {
  const snapshot = input.snapshot ?? (await buildRentSnapshot(input.listingId));
  if (!snapshot) return null;

  // 同 listing＋同 type 若已有 queued，合併（更新 snapshot）
  const store = await readSync591Jobs();
  const existing = store.jobs.find(
    (j) => j.listingId === input.listingId && j.type === input.type && j.status === "queued",
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.snapshot = snapshot;
    existing.updatedAt = now;
    await writeSync591Jobs(store);
    return existing;
  }

  const job: Sync591Job = {
    id: randomUUID(),
    type: input.type,
    listingId: input.listingId,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    lastError: null,
    log: [`enqueued:${input.type}`],
    snapshot,
  };
  store.jobs.unshift(job);
  await writeSync591Jobs(store);
  return job;
}

/** 依官網上架狀態推一組任務（有案號才推上下架；儲存一律推欄位／照片） */
export async function enqueueRentSyncAfterChange(input: {
  listingId: string;
  kind: "publish_toggle" | "save" | "status_only" | "expiry_only" | "retry_all";
  isPublished?: boolean;
}) {
  const snap = await buildRentSnapshot(input.listingId);
  if (!snap) return { jobs: [] as Sync591Job[] };

  const jobs: Sync591Job[] = [];
  const push = async (type: Sync591JobType) => {
    const j = await enqueueSync591Job({ listingId: input.listingId, type, snapshot: snap });
    if (j) jobs.push(j);
  };

  if (input.kind === "status_only") {
    await push("refresh_status");
    return { jobs };
  }

  if (input.kind === "expiry_only") {
    if (!snap.source591Id) return { jobs };
    await push("refresh_expiry");
    return { jobs };
  }

  if (input.kind === "publish_toggle") {
    if (input.isPublished) {
      await push("publish");
      await push("update_fields");
      await push("update_photos");
    } else {
      await push("unpublish");
    }
    return { jobs };
  }

  if (input.kind === "save" || input.kind === "retry_all") {
    await push("update_fields");
    await push("update_photos");
    if (snap.isPublished) await push("publish");
    else await push("unpublish");
    await push("refresh_status");
    return { jobs };
  }

  return { jobs };
}

/**
 * 掃描有 591 案號的租賃，排程抓到期日。
 * 預設略過「近 staleHours 小時內已查過」的物件，避免重複刷。
 */
export async function enqueue591ExpiryScan(opts?: {
  staleHours?: number;
  limit?: number;
  /** true：強制全部重查（仍受 limit） */
  force?: boolean;
}) {
  const staleHours = Math.max(1, opts?.staleHours ?? 20);
  const limit = Math.max(1, Math.min(80, opts?.limit ?? 40));
  const force = Boolean(opts?.force);
  const cutoff = Date.now() - staleHours * 3600 * 1000;

  const rows = await prisma.listing.findMany({
    where: {
      listingType: "RENT",
      source591Id: { not: null },
    },
    select: { id: true, description: true, source591Id: true },
    orderBy: { updatedAt: "desc" },
  });

  const jobs: Sync591Job[] = [];
  for (const row of rows) {
    if (jobs.length >= limit) break;
    if (!(row.source591Id || "").trim()) continue;
    if (!force) {
      const meta = parseListingInternalMeta(row.description);
      const checked = meta.source591ExpireCheckedAt ? Date.parse(meta.source591ExpireCheckedAt) : 0;
      if (Number.isFinite(checked) && checked > cutoff) continue;
    }
    const j = await enqueueSync591Job({ listingId: row.id, type: "refresh_expiry" });
    if (j) jobs.push(j);
  }
  return { jobs, scannedCandidates: rows.length };
}

export async function claimNextSync591Jobs(limit = 3): Promise<Sync591Job[]> {
  const store = await readSync591Jobs();
  const now = new Date().toISOString();
  const claimed: Sync591Job[] = [];
  for (const job of store.jobs) {
    if (claimed.length >= limit) break;
    if (job.status !== "queued") continue;
    job.status = "running";
    job.startedAt = now;
    job.updatedAt = now;
    job.attempts += 1;
    job.log = [...(job.log ?? []).slice(-40), `claimed@${now}`];
    claimed.push(job);
  }
  if (claimed.length) await writeSync591Jobs(store);
  return claimed;
}

export async function completeSync591Job(input: {
  jobId: string;
  status: "done" | "failed" | "needs_login";
  error?: string | null;
  logLine?: string;
  result591Id?: string | null;
  result591Url?: string | null;
  result591Status?: Source591Status | null;
  /** YYYY-MM-DD */
  resultExpiresAt?: string | null;
}) {
  const store = await readSync591Jobs();
  const job = store.jobs.find((j) => j.id === input.jobId);
  if (!job) return null;
  const now = new Date().toISOString();
  job.status = input.status;
  job.updatedAt = now;
  job.finishedAt = now;
  job.lastError = input.error ?? null;
  if (input.logLine) job.log = [...(job.log ?? []).slice(-40), input.logLine];
  if (input.result591Id !== undefined) job.result591Id = input.result591Id;
  if (input.result591Url !== undefined) job.result591Url = input.result591Url;
  if (input.result591Status !== undefined) job.result591Status = input.result591Status;
  if (input.resultExpiresAt !== undefined) job.resultExpiresAt = input.resultExpiresAt;
  await writeSync591Jobs(store);

  // 回寫 listing
  const listing = await prisma.listing.findUnique({
    where: { id: job.listingId },
    select: { id: true, description: true, source591Id: true, source591Url: true },
  });
  if (listing) {
    const meta = parseListingInternalMeta(listing.description);
    const expiresAt =
      typeof input.resultExpiresAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.resultExpiresAt)
        ? input.resultExpiresAt
        : input.resultExpiresAt === null
          ? null
          : undefined;
    const nextMeta = {
      ...meta,
      source591Status: input.result591Status ?? meta.source591Status ?? null,
      source591CheckedAt: now,
      source591SyncedAt: input.status === "done" ? now : meta.source591SyncedAt ?? null,
      source591SyncError:
        input.status === "done" ? null : (input.error || meta.source591SyncError || null),
      source591LastJobId: job.id,
      ...(expiresAt !== undefined
        ? {
            source591ExpiresAt: expiresAt,
            source591ExpireCheckedAt: now,
          }
        : job.type === "refresh_expiry" && input.status === "done"
          ? { source591ExpireCheckedAt: now }
          : {}),
    };
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        description: toListingDescription(nextMeta),
        ...(input.result591Id
          ? { source591Id: input.result591Id, source591Url: input.result591Url || listing.source591Url }
          : {}),
      },
    });
  }

  return job;
}

export async function listJobsForListing(listingId: string, limit = 20) {
  const store = await readSync591Jobs();
  return store.jobs.filter((j) => j.listingId === listingId).slice(0, limit);
}

export async function requeueJob(jobId: string) {
  const store = await readSync591Jobs();
  const job = store.jobs.find((j) => j.id === jobId);
  if (!job) return null;
  const snap = await buildRentSnapshot(job.listingId);
  if (snap) job.snapshot = snap;
  job.status = "queued";
  job.updatedAt = new Date().toISOString();
  job.finishedAt = null;
  job.lastError = null;
  job.log = [...(job.log ?? []).slice(-40), "requeued"];
  await writeSync591Jobs(store);
  return job;
}
