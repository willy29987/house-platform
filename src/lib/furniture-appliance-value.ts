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
