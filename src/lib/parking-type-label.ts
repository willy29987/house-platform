/** 目前表單提供的車位型式（順序即下拉選單順序）。「自訂」由表單另外處理，直接存使用者輸入的文字。 */
export const PARKING_TYPE_OPTIONS = [
  "FLAT_RAMP",
  "RAMP_MECHANICAL",
  "LIFT_FLAT",
  "LIFT_MECHANICAL",
  "STORAGE",
  "FRONT_DOOR",
] as const;

/** 舊版本曾使用、現已不在選單中的代碼；為了讓舊資料仍能正確顯示而保留。 */
export const LEGACY_PARKING_TYPES = ["MECHANICAL_LIFT", "MECHANICAL_FLAT"] as const;

export const PARKING_TYPE_LABELS: Record<string, string> = {
  FLAT_RAMP: "坡道平面",
  RAMP_MECHANICAL: "坡道機械",
  LIFT_FLAT: "升降平面",
  LIFT_MECHANICAL: "升降機械",
  STORAGE: "倉儲式車位",
  FRONT_DOOR: "門口可停車",
  // 舊資料
  MECHANICAL_LIFT: "機械升降",
  MECHANICAL_FLAT: "機械平面",
  OTHER: "其他",
};

/** 將表單/資料庫的車位型式代碼轉成中文；已是中文（自訂）或未知則原樣顯示。 */
export function formatParkingTypeLabel(type: string | null | undefined): string {
  if (type == null || !String(type).trim()) return "無";
  const key = String(type).trim();
  return PARKING_TYPE_LABELS[key] ?? key;
}
