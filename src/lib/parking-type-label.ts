const PARKING_TYPE_LABELS: Record<string, string> = {
  FLAT_RAMP: "坡道平面",
  MECHANICAL_LIFT: "機械升降",
  MECHANICAL_FLAT: "機械平面",
  RAMP_MECHANICAL: "坡道機械",
  FRONT_DOOR: "門口可停車",
  OTHER: "其他",
};

/** 將表單/資料庫的車位型式代碼轉成中文；已是中文或未知則原樣顯示。 */
export function formatParkingTypeLabel(type: string | null | undefined): string {
  if (type == null || !String(type).trim()) return "無";
  const key = String(type).trim();
  return PARKING_TYPE_LABELS[key] ?? key;
}
