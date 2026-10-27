/**
 * Google 試算表／Excel 匯入與 AdminCloudData 寫入共用邏輯。
 * 與 src/lib/owner-tracking-preview.ts、push-local-admin-data-to-cloud.mjs 對齊。
 */
import ExcelJS from "exceljs";

export const CLOUD_KEYS = {
  ownerTracking: "owner_tracking",
  commissionRecords: "commission_records",
  tenantManager: "tenant_manager",
};

export const PROPERTY_TYPE_LABEL = {
  APARTMENT: "公寓",
  ELEVATOR_BUILDING: "電梯大樓",
  HOUSE: "透天",
  STUDIO: "獨立套房",
  SUITE: "分租套房",
  OFFICE: "辦公",
  SHOP: "店面",
};

const OWNER_TRACKING_STATUS = ["持續聯繫", "只可帶看", "可上591", "屋主已出租"];

const LEGACY_STATUS = {
  "已接／再聯絡": "持續聯繫",
  已約看: "只可帶看",
  考慮中: "持續聯繫",
  暫停追蹤: "持續聯繫",
  未接: "持續聯繫",
  同意委託: "可上591",
  已出租結案: "屋主已出租",
  "無效／重複": "持續聯繫",
};

export function str(v, fallback = "") {
  return v == null ? fallback : String(v).trim();
}

export function cellToPlain(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map(cellToPlain).join("");
    if (value.text != null) return str(value.text);
    if (value.hyperlink) return str(value.text ?? value.hyperlink);
    if (value.result != null) return str(value.result);
    if (value.richText) return value.richText.map((t) => t.text ?? "").join("");
  }
  return String(value).trim();
}

/** @param {import('exceljs').Worksheet} sheet */
export function sheetToRecords(sheet) {
  if (!sheet || sheet.rowCount < 1) return { headers: [], rows: [] };
  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellToPlain(cell.value);
  });
  while (headers.length && !headers[headers.length - 1]) headers.pop();

  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      const val = cellToPlain(row.getCell(c + 1).value);
      if (val) any = true;
      obj[h] = val;
    }
    if (any) rows.push(obj);
  }
  return { headers, rows };
}

/** @param {import('exceljs').Workbook} workbook */
export function findSheet(workbook, preferredNames) {
  for (const name of preferredNames) {
    const s = workbook.getWorksheet(name);
    if (s) return s;
  }
  return workbook.worksheets[0] ?? null;
}

export async function loadWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

export function normalizeFollowUpStatus(status) {
  const t = str(status);
  if (LEGACY_STATUS[t]) return LEGACY_STATUS[t];
  if (OWNER_TRACKING_STATUS.includes(t)) return t;
  return "持續聯繫";
}

export function propertyTypeFromLabel(label) {
  const t = str(label);
  if (!t) return "";
  for (const [code, lbl] of Object.entries(PROPERTY_TYPE_LABEL)) {
    if (lbl === t) return code;
  }
  if (Object.hasOwn(PROPERTY_TYPE_LABEL, t)) return t;
  return t;
}

export function newImportId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeOwnerTrackingStore(store) {
  if (!store || typeof store !== "object") return { cases: [], followUps: [] };
  const cases = (store.cases ?? []).map((raw) => ({
    id: str(raw.id, newImportId("case")),
    assignee: str(raw.assignee, "—"),
    createdAt: str(raw.createdAt, new Date().toISOString()),
    address: str(raw.address),
    city: str(raw.city),
    district: str(raw.district),
    floor: str(raw.floor),
    totalFloors: str(raw.totalFloors),
    propertyType: str(raw.propertyType),
    community: str(raw.community),
    ownerName: str(raw.ownerName),
    phone: str(raw.phone),
    listingUrl: str(raw.listingUrl ?? raw.listingTitle),
    rent: str(raw.rent),
    layout: str(raw.layout),
    areaPing: str(raw.areaPing),
    managementFee: str(raw.managementFee),
    otherFees: str(raw.otherFees),
    parking: str(raw.parking),
    parkingNumber: str(raw.parkingNumber),
    parkingPrice: str(raw.parkingPrice),
    pets: str(raw.pets),
    rentSubsidy: str(raw.rentSubsidy),
    taxFiling: str(raw.taxFiling),
    householdRegistration: str(raw.householdRegistration),
    serviceFee: str(raw.serviceFee),
    specialMatters: str(raw.specialMatters),
    caseNote: str(raw.caseNote),
  }));
  const followUps = (store.followUps ?? []).map((f) => ({
    id: str(f.id, newImportId("fu")),
    caseId: str(f.caseId),
    status: normalizeFollowUpStatus(f.status),
    note: str(f.note),
    createdBy: str(f.createdBy),
    createdAt: str(f.createdAt, new Date().toISOString()),
  }));
  return { cases, followUps };
}

export function ownerCaseDedupeKey(c) {
  return [c.city, c.district, c.address, c.ownerName, c.phone]
    .map((s) => str(s).toLowerCase())
    .join("|");
}

export function mergeOwnerTracking(existing, incoming, { mode = "merge" } = {}) {
  const base = mode === "replace" ? { cases: [], followUps: [] } : normalizeOwnerTrackingStore(existing ?? {});
  const added = normalizeOwnerTrackingStore(incoming ?? {});

  const casesById = new Map(base.cases.map((c) => [c.id, c]));
  const dedupeToId = new Map(base.cases.map((c) => [ownerCaseDedupeKey(c), c.id]));

  for (const c of added.cases) {
    const dk = ownerCaseDedupeKey(c);
    if (dedupeToId.has(dk)) continue;
    if (casesById.has(c.id) && mode === "merge") continue;
    casesById.set(c.id, c);
    dedupeToId.set(dk, c.id);
  }

  const followById = new Map(base.followUps.map((f) => [f.id, f]));
  for (const f of added.followUps) {
    if (!f.caseId) continue;
    if (!casesById.has(f.caseId)) continue;
    if (followById.has(f.id) && mode === "merge") continue;
    followById.set(f.id, f);
  }

  return normalizeOwnerTrackingStore({
    cases: [...casesById.values()],
    followUps: [...followById.values()],
  });
}

export function mergeCommissionRecords(existing, incoming, { mode = "merge" } = {}) {
  const baseArr = mode === "replace" ? [] : Array.isArray(existing) ? existing : [];
  const added = Array.isArray(incoming) ? incoming : [];
  const byId = new Map();
  for (const r of baseArr) {
    if (r?.id) byId.set(r.id, r);
  }
  for (const r of added) {
    if (!r?.id) continue;
    if (byId.has(r.id) && mode === "merge") continue;
    byId.set(r.id, r);
  }
  return [...byId.values()];
}

export function mergeTenantManager(existing, incoming, { mode = "merge" } = {}) {
  const base =
    mode === "replace"
      ? { tenants: [], rent: {}, utility: {} }
      : {
          tenants: existing?.tenants ?? [],
          rent: existing?.rent ?? {},
          utility: existing?.utility ?? {},
        };
  const added = incoming ?? { tenants: [], rent: {}, utility: {} };

  const tenantsById = new Map(base.tenants.map((t) => [t.id, t]));
  for (const t of added.tenants ?? []) {
    if (!t?.id) continue;
    if (tenantsById.has(t.id) && mode === "merge") continue;
    tenantsById.set(t.id, t);
  }
  return {
    tenants: [...tenantsById.values()],
    rent: { ...base.rent, ...(added.rent ?? {}) },
    utility: { ...base.utility, ...(added.utility ?? {}) },
  };
}

export function pickRow(row, aliases) {
  for (const key of aliases) {
    if (row[key] != null && str(row[key])) return str(row[key]);
  }
  return "";
}

/** 試算表「00-租賃追蹤表」等整段地址 */
export function parseTaiwanAddress(full) {
  const raw = str(full);
  if (!raw) return { city: "", district: "", address: "" };
  const cities = ["新北市", "台北市", "桃園市", "台中市", "台南市", "高雄市", "基隆市", "新竹市", "嘉義市"];
  const sorted = [...cities].sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    const idx = raw.indexOf(city);
    if (idx === -1) continue;
    const afterCity = raw.slice(idx + city.length);
    const m = afterCity.match(/^(.+?區)(.*)$/);
    if (m) {
      return { city, district: m[1], address: str(m[2]) || raw };
    }
    return { city, district: "", address: str(afterCity) || raw };
  }
  return { city: "", district: "", address: raw };
}

export function parseFloorCell(raw) {
  const t = str(raw);
  if (!t) return { floor: "", totalFloors: "" };
  if (t.includes("/")) {
    const [a, b] = t.split("/").map((x) => x.trim());
    const stripF = (s) => s.replace(/F$/i, "").trim();
    return { floor: stripF(a), totalFloors: stripF(b) };
  }
  return { floor: t.replace(/F$/i, "").trim(), totalFloors: "" };
}

/** @param {import('exceljs').Worksheet} sheet */
export function sheetHeaderSet(sheet) {
  const headers = new Set();
  if (!sheet) return headers;
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    const h = cellToPlain(cell.value);
    if (h) headers.add(h);
  });
  return headers;
}

export function isRentalTrackingSheet(sheet) {
  const h = sheetHeaderSet(sheet);
  return h.has("物件地址") && (h.has("開發日期") || h.has("進度"));
}

export function parseListingType(raw) {
  const t = str(raw).toUpperCase();
  if (["RENT", "租", "租賃", "出租", "租赁"].includes(t) || raw === "租賃") return "RENT";
  if (["SALE", "賣", "買賣", "出售", "售"].includes(t) || raw === "買賣") return "SALE";
  if (t.includes("租")) return "RENT";
  if (t.includes("賣") || t.includes("售")) return "SALE";
  return "OTHER";
}

export function parseBoolCell(raw) {
  const t = str(raw);
  if (["是", "Y", "YES", "TRUE", "1", "已收", "✓"].includes(t.toUpperCase()) || t === "是") return true;
  if (["否", "N", "NO", "FALSE", "0", "未收"].includes(t.toUpperCase()) || t === "否") return false;
  return true;
}

export function parseNumberCell(raw) {
  const t = str(raw).replace(/[,，]/g, "");
  const n = Number(t.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function readExistingCloud(prisma) {
  const rows = await prisma.adminCloudData.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.payload]));
}

export async function upsertCloudPayload(prisma, cloudKey, payload) {
  await prisma.adminCloudData.upsert({
    where: { key: cloudKey },
    create: { key: cloudKey, payload },
    update: { payload },
  });
}

export function countPayload(key, payload) {
  if (key === CLOUD_KEYS.ownerTracking && payload && typeof payload === "object") {
    return `${payload.cases?.length ?? 0} cases, ${payload.followUps?.length ?? 0} followUps`;
  }
  if (key === CLOUD_KEYS.commissionRecords && Array.isArray(payload)) {
    return `${payload.length} records`;
  }
  if (key === CLOUD_KEYS.tenantManager && payload && typeof payload === "object") {
    return `${payload.tenants?.length ?? 0} tenants`;
  }
  return "ok";
}
