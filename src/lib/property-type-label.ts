/** 房屋型態與舊物件類別代碼的中文。新表單只用公寓、電梯、別墅、透天厝。 */
export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  APARTMENT: "公寓",
  ELEVATOR_BUILDING: "電梯",
  VILLA: "別墅",
  HOUSE: "透天厝",
  STUDIO: "獨立套房",
  SUITE: "分租套房",
  OFFICE: "辦公",
  SHOP: "店面",
};

export const PROPERTY_TYPE_OPTIONS = ["APARTMENT", "ELEVATOR_BUILDING", "VILLA", "HOUSE"] as const;

export type PropertyTypeOption = (typeof PROPERTY_TYPE_OPTIONS)[number];

export function propertyTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return PROPERTY_TYPE_LABEL[type] ?? type;
}
