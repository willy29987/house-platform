/** 新增廣告用 591 帶入並上架後，把同一筆詳細資料寫進屋主追蹤的「只可帶看」。 */

import { ADMIN_CLOUD_DATA_KEYS } from "@/lib/admin-cloud-data-keys";
import { readAdminCloudPayload, writeAdminCloudPayload } from "@/lib/admin-cloud-data-server";
import { LAYOUT_OPEN_LABEL, layoutUiToStored } from "@/lib/owner-tracking-form-ui";
import { extract591ListingId } from "@/lib/listing-591-id";
import type { ListingInput } from "@/lib/listing-validation";
import {
  appendOwnerCase,
  lastFollowUp,
  newId,
  normalizeOwnerTrackingStore,
  ownerCaseToInput,
  patchOwnerCaseLinkedListing,
  updateOwnerCase,
  type OwnerCaseInput,
  type OwnerTrackingStore,
} from "@/lib/owner-tracking-preview";
import { normalizeOwnerContactPhone } from "@/lib/house-fields";
import { taipeiTodayYmd } from "@/lib/owner-tracking-next-contact";

const VIEWABLE_STATUS = "只可帶看" as const;

function followUpTaipeiYmd(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) || taipeiTodayYmd(now);
}

/** 內容有變的自抓更新：同一案件當天只記一筆電訪，避免同日多次同步灌水 */
function ensureSameDaySyncFollowUp(
  store: OwnerTrackingStore,
  caseId: string,
  assignee: string,
  now = new Date(),
): OwnerTrackingStore {
  const day = taipeiTodayYmd(now);
  const hasToday = store.followUps.some(
    (row) => row.caseId === caseId && followUpTaipeiYmd(row.createdAt, now) === day,
  );
  if (hasToday) return store;
  const prev = lastFollowUp(store, caseId);
  return {
    ...store,
    followUps: [
      ...store.followUps,
      {
        id: newId("fu"),
        caseId,
        status: prev?.status || VIEWABLE_STATUS,
        note: "",
        createdBy: assignee,
        createdAt: now.toISOString(),
      },
    ],
  };
}

function text(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).trim();
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "可";
  if (value === false) return "不可";
  return "";
}

function rentText(data: ListingInput): string {
  if (data.listingType === "SALE" && data.price >= 10000 && data.price % 10000 === 0) {
    return `${data.price / 10000}萬`;
  }
  return String(data.price);
}

function managementFeeText(value: number | null | undefined): string {
  if (value === 0) return "無";
  if (value == null) return "含在租金裡";
  return String(value);
}

function parkingPriceText(data: ListingInput): string {
  if (!text(data.parkingType)) return "";
  const amount = data.listingType === "SALE" ? data.parkingPrice : data.parkingRent;
  if (amount == null || amount <= 0) return "含在租金內";
  if (data.listingType === "SALE" && amount >= 10000 && amount % 10000 === 0) return `${amount / 10000}萬`;
  return String(amount);
}

function layoutText(data: ListingInput): string {
  return layoutUiToStored({
    rooms: data.rooms > 0 ? String(data.rooms) : "",
    living: data.livingRooms != null && data.livingRooms > 0 ? String(data.livingRooms) : "",
    bath: data.bathrooms > 0 ? String(data.bathrooms) : "",
    balcony: data.balconies != null && data.balconies > 0 ? String(data.balconies) : "",
    openLayout: (data.features ?? []).some((feature) => feature.includes(LAYOUT_OPEN_LABEL)),
  });
}

function viewingText(value: string | null | undefined): string {
  if (value === "KEY") return "有鑰匙，隨時可帶看";
  if (value === "OWNER_APPOINTMENT") return "需約屋主時間";
  return text(value);
}

function areaBits(data: ListingInput): string {
  const parts = [
    data.areaMain != null ? `主建物 ${data.areaMain} 坪` : "",
    data.areaAncillary != null ? `附屬 ${data.areaAncillary} 坪` : "",
    data.areaCommon != null ? `公設 ${data.areaCommon} 坪` : "",
    data.areaLand != null ? `土地 ${data.areaLand} 坪` : "",
    data.areaParkingSpace != null ? `車位 ${data.areaParkingSpace} 坪` : "",
  ].filter(Boolean);
  return parts.join("、");
}

function extraNote(data: ListingInput): string {
  const features = (data.features ?? []).filter((feature) => !feature.includes(LAYOUT_OPEN_LABEL));
  const lines = [
    text(data.title) ? `標題：${text(data.title)}` : "",
    data.floor != null || data.totalFloors != null
      ? `樓層：${data.floor != null ? `${data.floor}F` : "—"}${data.totalFloors != null ? ` / 共 ${data.totalFloors}F` : ""}`
      : "",
    text(data.mrtLine) || text(data.mrtStation)
      ? `捷運：${[text(data.mrtLine), text(data.mrtStation)].filter(Boolean).join(" ")}`
      : "",
    viewingText(data.viewingMethod) ? `帶看方式：${viewingText(data.viewingMethod)}` : "",
    text(data.securityDeposit) ? `押金：${text(data.securityDeposit)}` : "",
    text(data.availableFrom) ? `可遷入：${text(data.availableFrom)}` : "",
    text(data.roomNumber) ? `房號：${text(data.roomNumber)}` : "",
    text(data.householdsPerFloor) ? `每層戶數：${text(data.householdsPerFloor)}` : "",
    (data.furnitureItems ?? []).length ? `家具：${data.furnitureItems!.join("、")}` : "",
    (data.equipmentItems ?? []).length ? `設備：${data.equipmentItems!.join("、")}` : "",
    features.length ? `特色：${features.join("、")}` : "",
    areaBits(data) ? `坪數明細：${areaBits(data)}` : "",
    text(data.shortTermRent) ? `短租：${text(data.shortTermRent)}` : "",
    text(data.registrationUse) ? `登記用途：${text(data.registrationUse)}` : "",
    data.buildingAge != null ? `屋齡：${data.buildingAge}` : "",
    text(data.orientation) ? `座向：${text(data.orientation)}` : "",
    text(data.decorLevel) ? `裝潢：${text(data.decorLevel)}` : "",
    text(data.usageZoning) ? `分區：${text(data.usageZoning)}` : "",
    text(data.legalUsage) ? `法定用途：${text(data.legalUsage)}` : "",
    data.hasElevator === true ? "電梯：有" : data.hasElevator === false ? "電梯：無" : "",
    text(data.videoUrl) ? `影片：${text(data.videoUrl)}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function listingInputToOwnerCase(data: ListingInput): OwnerCaseInput {
  const subsidy =
    data.rentSubsidy === true ? "可申請" : data.rentSubsidy === false ? "不可申請" : "";
  return {
    address: data.address,
    city: data.city,
    district: data.district,
    floor: data.floor != null ? String(data.floor) : "",
    totalFloors: data.totalFloors != null ? String(data.totalFloors) : "",
    propertyType: data.propertyType,
    houseCondition: data.houseCondition ?? "",
    community: text(data.community),
    ownerName: data.contactName,
    phone: normalizeOwnerContactPhone(data.contactPhone),
    listingUrl: text(data.source591Url) || text(data.source591Id),
    rent: rentText(data),
    layout: layoutText(data),
    areaPing: String(data.areaPing),
    managementFee: managementFeeText(data.managementFee),
    otherFees: text(data.otherFees),
    parking: text(data.parkingType),
    parkingNumber: text(data.parkingSpaceInfo),
    parkingPrice: parkingPriceText(data),
    pets: yesNo(data.petsAllowed),
    rentSubsidy: subsidy,
    taxFiling: yesNo(data.taxDeductible),
    householdRegistration: yesNo(data.canRegisterAddress),
    serviceFee: text(data.serviceFee),
    specialMatters: text(data.specialMatters),
    caseNote: extraNote(data),
    nextContactDate: "",
    expectedReleaseDate: "",
  };
}

function same591(left: string, right: string): boolean {
  const a = extract591ListingId(left);
  const b = extract591ListingId(right);
  if (a && b) return a === b;
  return Boolean(left.trim()) && left.trim() === right.trim();
}

function fillEmptyFields(current: OwnerCaseInput, incoming: OwnerCaseInput): OwnerCaseInput {
  const next = { ...current };
  (Object.keys(incoming) as (keyof OwnerCaseInput)[]).forEach((key) => {
    if (!text(current[key]) && text(incoming[key])) next[key] = incoming[key];
  });
  const extra = incoming.caseNote
    .split("\n")
    .filter((line) => line.trim() && !current.caseNote.includes(line.trim()));
  if (extra.length) {
    next.caseNote = [current.caseNote.trim(), ...extra].filter(Boolean).join("\n");
  }
  return next;
}

function overwriteNonEmptyFields(current: OwnerCaseInput, incoming: OwnerCaseInput): OwnerCaseInput {
  const next = { ...current };
  (Object.keys(incoming) as (keyof OwnerCaseInput)[]).forEach((key) => {
    if (key === "caseNote") return;
    if (text(incoming[key])) next[key] = incoming[key];
  });
  if (text(incoming.caseNote)) next.caseNote = incoming.caseNote;
  return next;
}

/** 591 自動抓取產生的備註（標題：…／自動同步等），不應留在追蹤裡 */
export function isAutoScrapedOwnerTrackingNote(note: string): boolean {
  const n = note.trim();
  if (!n) return false;
  if (n.includes("自動同步")) return true;
  if (n.includes("591 帶入") || n.includes("帶入上架")) return true;
  if (n.startsWith("標題：") || n.includes("\n標題：")) return true;
  return false;
}

export async function addPublishedListingToViewableOwnerCase(input: {
  listingId: string;
  data: ListingInput;
  assignee: string;
  /** 新建追蹤時的備註；預設為手動上架文案 */
  initialNote?: string;
  /** 已存在時：true 則用新資料覆寫非空欄位（預設只補空欄） */
  overwriteExisting?: boolean;
  /**
   * 591 自動抓取：不寫案件備註／追蹤備註；
   * 已存在時也清掉自動備註，並覆寫負責人。
   */
  suppressNotes?: boolean;
}): Promise<string | null> {
  const listingId = input.listingId.trim();
  if (!listingId) return null;
  const assignee = input.assignee.trim() || "R001";

  const incoming = listingInputToOwnerCase(input.data);
  if (input.suppressNotes) {
    incoming.caseNote = "";
  }
  const raw = await readAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking);
  const store = normalizeOwnerTrackingStore(
    (raw as OwnerTrackingStore | null) ?? { cases: [], followUps: [] },
  );
  const source = incoming.listingUrl;
  const existing = source
    ? store.cases.find((row) => same591(row.listingUrl, source) || row.linkedListingId === listingId)
    : store.cases.find((row) => row.linkedListingId === listingId);

  let next = store;
  let caseId = existing?.id ?? "";
  if (!existing) {
    const created = appendOwnerCase(store, incoming, assignee, VIEWABLE_STATUS);
    caseId = created.caseId;
    const note = input.suppressNotes
      ? ""
      : input.initialNote !== undefined
        ? input.initialNote.trim()
        : "從新增廣告的 591 帶入上架，加入可帶看";
    next = {
      ...created.store,
      followUps: created.store.followUps.map((row) =>
        row.caseId === caseId ? { ...row, note } : row,
      ),
    };
  } else {
    const base = ownerCaseToInput(existing);
    let merged = input.overwriteExisting
      ? overwriteNonEmptyFields(base, incoming)
      : fillEmptyFields(base, incoming);
    if (input.suppressNotes) {
      merged = {
        ...merged,
        caseNote: "",
        // overwriteNonEmpty 清不掉舊電話；自抓以物件電話為準（轉接會是空）
        phone: normalizeOwnerContactPhone(incoming.phone),
      };
    }
    const filled = updateOwnerCase(store, existing.id, merged);
    next = filled ?? store;
    if (input.suppressNotes) {
      next = {
        ...next,
        cases: next.cases.map((row) =>
          row.id === existing.id
            ? {
                ...row,
                assignee,
                caseNote: "",
                phone: normalizeOwnerContactPhone(row.phone),
              }
            : row,
        ),
        followUps: next.followUps.map((row) => {
          if (row.caseId !== existing.id) return row;
          if ((row.createdBy || "").trim().toLowerCase() === "system") {
            return {
              ...row,
              createdBy: assignee,
              note: isAutoScrapedOwnerTrackingNote(row.note) ? "" : row.note,
            };
          }
          if (isAutoScrapedOwnerTrackingNote(row.note)) {
            return { ...row, note: "" };
          }
          return row;
        }),
      };
      // 既有案件被自抓更新時，若今天還沒有追蹤筆，補一筆空備註電訪
      next = ensureSameDaySyncFollowUp(next, existing.id, assignee);
    }
  }

  next = patchOwnerCaseLinkedListing(next, caseId, listingId);
  await writeAdminCloudPayload(ADMIN_CLOUD_DATA_KEYS.ownerTracking, next);
  return caseId;
}
