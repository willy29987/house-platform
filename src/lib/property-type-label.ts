/** 物件類別（PropertyType）對應的中文顯示名稱 */
export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  APARTMENT: "公寓",
  ELEVATOR_BUILDING: "電梯大樓",
  HOUSE: "透天",
  STUDIO: "獨立套房",
  SUITE: "分租套房",
  OFFICE: "辦公",
  SHOP: "店面",
};

export const PROPERTY_TYPE_OPTIONS = [
  "APARTMENT",
  "ELEVATOR_BUILDING",
  "STUDIO",
  "SUITE",
  "OFFICE",
  "SHOP",
  "HOUSE",
] as const;

export type PropertyTypeOption = (typeof PROPERTY_TYPE_OPTIONS)[number];

export function propertyTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return PROPERTY_TYPE_LABEL[type] ?? type;
}
