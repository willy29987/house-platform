/** 內部 meta 與 API 使用的「家具／家電」狀態：有、無、可討論 */
export type FurnitureApplianceValue = boolean | "DISCUSS" | null;

export function normalizeFurnitureApplianceValue(raw: unknown): FurnitureApplianceValue {
  if (raw === true || raw === false) return raw;
  if (raw === "DISCUSS") return "DISCUSS";
  return null;
}

export function furnitureApplianceToFormTri(v: FurnitureApplianceValue | undefined): "" | "yes" | "no" | "discuss" {
  if (v === true) return "yes";
  if (v === false) return "no";
  if (v === "DISCUSS") return "discuss";
  return "";
}

export function formTriToFurnitureAppliance(v: "" | "yes" | "no" | "discuss"): FurnitureApplianceValue {
  if (v === "yes") return true;
  if (v === "no") return false;
  if (v === "discuss") return "DISCUSS";
  return null;
}

export function formatFurnitureApplianceZh(v: FurnitureApplianceValue | undefined): string {
  if (v === true) return "有";
  if (v === false) return "無";
  if (v === "DISCUSS") return "可討論";
  return "—";
}

/** 表單可勾選的設備（舊稱「家電」） */
export const EQUIPMENT_ITEMS = [
  "洗衣機",
  "冰箱",
  "電視",
  "冷氣",
  "熱水器",
  "網路",
  "第四台",
  "天然瓦斯",
] as const;

/** 表單可勾選的家具 */
export const FURNITURE_ITEMS = ["床", "衣櫃", "沙發", "桌子", "椅子"] as const;

/** 把 meta / API 傳來的值整理成字串陣列（去除空白與重複）。 */
export function normalizeItemList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(items));
}

/**
 * 列表 / 詳細資料用的「家具 / 設備」文字。
 * 有勾選項目就顯示項目；沒有則退回舊資料的「有 / 無 / 可討論」。
 */
export function formatFurnitureAndEquipmentZh(args: {
  furnitureItems?: string[] | null;
  furnitureLegacy?: FurnitureApplianceValue;
  equipmentItems?: string[] | null;
  equipmentLegacy?: FurnitureApplianceValue;
}): string {
  const furniture = args.furnitureItems?.length
    ? args.furnitureItems.join("、")
    : formatFurnitureApplianceZh(args.furnitureLegacy);
  const equipment = args.equipmentItems?.length
    ? args.equipmentItems.join("、")
    : formatFurnitureApplianceZh(args.equipmentLegacy);
  return `${furniture} / ${equipment}`;
}
