/** LINE／LIFF 找房案件：寫入 AdminCloudData，供客服收件匣讀取。 */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";

export type LineRentalCasePicked = {
  id: string;
  title: string;
  price: number;
};

export type LineRentalCaseKind = "viewing" | "591_link" | "image_inquiry";

export type LineRentalCaseStatus =
  | "pending_confirm"
  | "awaiting_staff"
  | "awaiting_agent"
  | "agent_proposing"
  | "reschedule_sent"
  | "confirmed";

export type LineRentalCase = {
  id: string;
  createdAt: string;
  status: LineRentalCaseStatus;
  kind: LineRentalCaseKind;
  lineUserId: string | null;
  displayName: string;
  phone: string;
  occupation: string;
  nationality: string;
  peopleCount: number;
  petNote: string;
  moveInDate: string;
  criteriaText: string;
  picked: LineRentalCasePicked[];
  requestedWhen: string;
  proposedWhen: string;
  summaryText: string;
  source591Id?: string;
  source591Url?: string;
  guestMessage?: string;
  handledByAgentLineUserId?: string | null;
};

export type LineRentalCasesStore = {
  cases: LineRentalCase[];
};

const STATUS_SET = new Set<LineRentalCaseStatus>([
  "pending_confirm",
  "awaiting_staff",
  "awaiting_agent",
  "agent_proposing",
  "reschedule_sent",
  "confirmed",
]);

export function emptyLineRentalCasesStore(): LineRentalCasesStore {
  return { cases: [] };
}

function normalizeStatus(raw: unknown): LineRentalCaseStatus {
  return typeof raw === "string" && STATUS_SET.has(raw as LineRentalCaseStatus)
    ? (raw as LineRentalCaseStatus)
    : "pending_confirm";
}

function normalizeCase(item: unknown): LineRentalCase | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Partial<LineRentalCase>;
  if (typeof row.id !== "string") return null;
  const kind: LineRentalCaseKind =
    row.kind === "591_link" || row.kind === "image_inquiry" ? row.kind : "viewing";
  return {
    id: row.id,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    status: normalizeStatus(row.status),
    kind,
    lineUserId: typeof row.lineUserId === "string" ? row.lineUserId : null,
    displayName: typeof row.displayName === "string" ? row.displayName : "LINE 客人",
    phone: typeof row.phone === "string" ? row.phone : "",
    occupation: typeof row.occupation === "string" ? row.occupation : "",
    nationality: typeof row.nationality === "string" ? row.nationality : "",
    peopleCount: Number.isFinite(row.peopleCount) ? Number(row.peopleCount) : 1,
    petNote: typeof row.petNote === "string" ? row.petNote : "",
    moveInDate: typeof row.moveInDate === "string" ? row.moveInDate : "",
    criteriaText: typeof row.criteriaText === "string" ? row.criteriaText : "",
    picked: Array.isArray(row.picked) ? (row.picked as LineRentalCasePicked[]) : [],
    requestedWhen: typeof row.requestedWhen === "string" ? row.requestedWhen : "",
    proposedWhen: typeof row.proposedWhen === "string" ? row.proposedWhen : "",
    summaryText: typeof row.summaryText === "string" ? row.summaryText : "",
    source591Id: typeof row.source591Id === "string" ? row.source591Id : "",
    source591Url: typeof row.source591Url === "string" ? row.source591Url : "",
    guestMessage: typeof row.guestMessage === "string" ? row.guestMessage : "",
    handledByAgentLineUserId:
      typeof row.handledByAgentLineUserId === "string" ? row.handledByAgentLineUserId : null,
  };
}

export function normalizeLineRentalCasesStore(raw: unknown): LineRentalCasesStore {
  if (!raw || typeof raw !== "object") return emptyLineRentalCasesStore();
  const cases = Array.isArray((raw as { cases?: unknown }).cases)
    ? ((raw as { cases: unknown[] }).cases.map(normalizeCase).filter(Boolean) as LineRentalCase[])
    : [];
  return { cases };
}

export async function readLineRentalCases(): Promise<LineRentalCase[]> {
  const payload = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineRentalCases);
  return normalizeLineRentalCasesStore(payload).cases;
}

export async function getLineRentalCase(id: string): Promise<LineRentalCase | null> {
  const cases = await readLineRentalCases();
  return cases.find((item) => item.id === id) ?? null;
}

export async function appendLineRentalCase(
  input: Omit<LineRentalCase, "id" | "createdAt" | "status" | "kind" | "proposedWhen" | "handledByAgentLineUserId"> & {
    kind?: LineRentalCaseKind;
    status?: LineRentalCaseStatus;
    proposedWhen?: string;
    handledByAgentLineUserId?: string | null;
  },
): Promise<LineRentalCase> {
  const store = normalizeLineRentalCasesStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineRentalCases),
  );
  const kind = input.kind ?? "viewing";
  const status: LineRentalCaseStatus =
    input.status ?? (kind === "viewing" ? "pending_confirm" : "awaiting_staff");

  const created: LineRentalCase = {
    ...input,
    kind,
    id: `lrc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status,
    proposedWhen: input.proposedWhen ?? "",
    handledByAgentLineUserId: input.handledByAgentLineUserId ?? null,
    source591Id: input.source591Id ?? "",
    source591Url: input.source591Url ?? "",
    guestMessage: input.guestMessage ?? "",
  };
  store.cases = [created, ...store.cases].slice(0, 200);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineRentalCases, store);
  return created;
}

export async function updateLineRentalCase(
  id: string,
  patch: Partial<
    Pick<
      LineRentalCase,
      | "status"
      | "summaryText"
      | "requestedWhen"
      | "proposedWhen"
      | "handledByAgentLineUserId"
    >
  >,
): Promise<LineRentalCase | null> {
  const store = normalizeLineRentalCasesStore(
    await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineRentalCases),
  );
  const index = store.cases.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next: LineRentalCase = {
    ...store.cases[index],
    ...patch,
  };
  store.cases[index] = next;
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.lineRentalCases, store);
  return next;
}

/** 找出此業務正在「準備輸入新時間」的案件（最新一筆） */
export async function findAgentProposingCase(
  agentLineUserId: string,
): Promise<LineRentalCase | null> {
  const cases = await readLineRentalCases();
  return (
    cases.find(
      (item) =>
        item.status === "agent_proposing" && item.handledByAgentLineUserId === agentLineUserId,
    ) ?? null
  );
}
