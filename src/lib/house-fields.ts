/** 房屋型態（建物）與房屋現況（用途）分開存。舊資料把套房／辦公／店面放在 propertyType。 */

export const BUILDING_TYPE_OPTIONS = ["APARTMENT", "ELEVATOR_BUILDING", "VILLA", "HOUSE"] as const;

export type BuildingTypeOption = (typeof BUILDING_TYPE_OPTIONS)[number];

export const BUILDING_TYPE_LABEL: Record<BuildingTypeOption, string> = {
  APARTMENT: "公寓",
  ELEVATOR_BUILDING: "電梯",
  VILLA: "別墅",
  HOUSE: "透天厝",
};

export const HOUSE_CONDITION_OPTIONS = ["WHOLE", "STUDIO", "SUITE", "LIVE_OFFICE", "OFFICE", "SHOP"] as const;

export type HouseConditionOption = (typeof HOUSE_CONDITION_OPTIONS)[number];

export const HOUSE_CONDITION_LABEL: Record<HouseConditionOption, string> = {
  WHOLE: "整層住家",
  STUDIO: "獨立套房",
  SUITE: "分租套房",
  LIVE_OFFICE: "住辦",
  OFFICE: "辦公",
  SHOP: "店面",
};

const LEGACY_PROPERTY_AS_CONDITION: Record<string, HouseConditionOption> = {
  STUDIO: "STUDIO",
  SUITE: "SUITE",
  OFFICE: "OFFICE",
  SHOP: "SHOP",
};

export function isBuildingType(value: string): value is BuildingTypeOption {
  return (BUILDING_TYPE_OPTIONS as readonly string[]).includes(value);
}

export function isHouseCondition(value: string): value is HouseConditionOption {
  return (HOUSE_CONDITION_OPTIONS as readonly string[]).includes(value);
}

export function houseConditionLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (isHouseCondition(value)) return HOUSE_CONDITION_LABEL[value];
  return LEGACY_PROPERTY_AS_CONDITION[value] ? HOUSE_CONDITION_LABEL[LEGACY_PROPERTY_AS_CONDITION[value]] : value;
}

export function buildingTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (isBuildingType(value)) return BUILDING_TYPE_LABEL[value];
  return value;
}

/** 讀舊案件：套房／辦公／店面改掛到房屋現況，房屋型態留空讓人再選。 */
export function splitHouseFields(
  propertyType: string,
  houseCondition = "",
): { building: string; condition: string; customBuilding: boolean } {
  const storedCondition = isHouseCondition(houseCondition) ? houseCondition : "";
  if (isBuildingType(propertyType)) {
    return { building: propertyType, condition: storedCondition, customBuilding: false };
  }
  const legacy = LEGACY_PROPERTY_AS_CONDITION[propertyType];
  if (legacy) {
    return { building: "", condition: storedCondition || legacy, customBuilding: false };
  }
  const text = propertyType.trim();
  if (text) return { building: text, condition: storedCondition, customBuilding: true };
  return { building: "", condition: storedCondition, customBuilding: false };
}

export function buildingTypeFromShape(shape: string): BuildingTypeOption | "" {
  const text = shape.trim();
  if (!text) return "";
  if (/別墅/.test(text)) return "VILLA";
  if (/電梯|華廈/.test(text)) return "ELEVATOR_BUILDING";
  if (/公寓/.test(text)) return "APARTMENT";
  if (/透天/.test(text)) return "HOUSE";
  return "";
}

export function houseConditionFromKind(kind: string): HouseConditionOption | "" {
  const text = kind.trim();
  if (!text) return "";
  if (/獨立套房/.test(text)) return "STUDIO";
  if (/分租套房|雅房/.test(text)) return "SUITE";
  if (/住辦/.test(text)) return "LIVE_OFFICE";
  if (/辦公/.test(text)) return "OFFICE";
  if (/店面|攤位/.test(text)) return "SHOP";
  if (/整層住家|住宅|住家/.test(text)) return "WHOLE";
  return "";
}

export function skipsLayout(condition: string): boolean {
  return condition === "STUDIO" || condition === "SUITE";
}

/** 591 聯絡名稱常前面帶「屋主／仲介」，欄位只留姓氏姓名。 */
export function formatOwnerPersonName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, " ");
  const prefix = /^(?:屋主|房東|所有權人|仲介)[\s:：\-—－/／|·・]*/;
  for (let i = 0; i < 3; i += 1) {
    const next = name.replace(prefix, "").trim();
    if (!next || next === name) break;
    name = next;
  }
  return name || raw.trim();
}

/** 591 常見轉接門號（只比對數字）。抓到視為沒電話。 */
const KNOWN_591_TRANSFER_PHONE_DIGITS = new Set([
  "0972528577", // 0972-528-577
]);

export function phoneDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** 591 轉接號／字面「轉接」→ 當作沒電話 */
export function is591TransferPhone(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  if (text.includes("轉接")) return true;
  return KNOWN_591_TRANSFER_PHONE_DIGITS.has(phoneDigitsOnly(text));
}

/** 寫入用：轉接號清空；其餘只留數字與連字號 */
export function normalizeOwnerContactPhone(raw: string): string {
  const text = raw.trim();
  if (!text || text === "無" || text === "—" || text === "-") return "";
  if (is591TransferPhone(text)) return "";
  return text.replace(/[^\d-]/g, "");
}

/**
 * 有真正可聯絡的電話。空的、「無」、字面上有「轉接」、
 * 已知 591 轉接門號，或把分機黏在手機後面的長號碼，都算沒有電話。
 */
export function isRealOwnerPhone(raw: string): boolean {
  const text = raw.trim();
  if (!text || text === "無" || text === "—" || text === "-") return false;
  if (is591TransferPhone(text)) return false;
  const digits = phoneDigitsOnly(text);
  return digits.length >= 8 && digits.length <= 10;
}

export function ownerContactFromTexts(nameRaw: string, imNameRaw: string, phoneRaw: string): { name: string; phone: string } {
  const fromName = formatOwnerPersonName(nameRaw);
  const fromIm = formatOwnerPersonName(imNameRaw);
  const name = fromName || fromIm;
  const phone = normalizeOwnerContactPhone(phoneRaw);
  return { name, phone };
}
