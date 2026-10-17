import {
  LEGACY_PARKING_TYPES,
  PARKING_TYPE_LABELS,
  PARKING_TYPE_OPTIONS,
} from "@/lib/parking-type-label";

/** 需填寫社區名稱的物件類別 */
export const COMMUNITY_PROPERTY_TYPES = ["ELEVATOR_BUILDING", "OFFICE", "SHOP"] as const;

export function needsCommunityName(propertyType: string, propertyTypeCustom: boolean): boolean {
  if (propertyTypeCustom) return false;
  return (COMMUNITY_PROPERTY_TYPES as readonly string[]).includes(propertyType);
}

export const PARKING_CUSTOM = "__CUSTOM__";

export type ParkingUi = { select: string; custom: string };

export function inferParkingFromStored(stored: string): ParkingUi {
  const t = stored.trim();
  if (!t) return { select: "", custom: "" };
  if ((PARKING_TYPE_OPTIONS as readonly string[]).includes(t)) return { select: t, custom: "" };
  if ((LEGACY_PARKING_TYPES as readonly string[]).includes(t)) return { select: t, custom: "" };
  const byLabel = Object.entries(PARKING_TYPE_LABELS).find(([, label]) => label === t);
  if (byLabel) return { select: byLabel[0], custom: "" };
  return { select: PARKING_CUSTOM, custom: t };
}

export function parkingUiToStored(ui: ParkingUi): string {
  if (!ui.select) return "";
  if (ui.select === PARKING_CUSTOM) return ui.custom.trim();
  return ui.select;
}

export const SERVICE_FEE_CHOICES = ["正常", "半個月", "無"] as const;
export const CHOICE_OTHER = "__OTHER__";

export type ChoiceUi = { select: string; other: string };

export function inferChoice(value: string, choices: readonly string[]): ChoiceUi {
  const t = value.trim();
  if (!t) return { select: "", other: "" };
  if (choices.includes(t)) return { select: t, other: "" };
  return { select: CHOICE_OTHER, other: t };
}

export function choiceToStored(ui: ChoiceUi): string {
  if (!ui.select) return "";
  if (ui.select === CHOICE_OTHER) return ui.other.trim();
  return ui.select;
}

export type PetsUi = "" | "yes" | "no";

export function inferPets(stored: string): PetsUi {
  const t = stored.trim();
  if (t === "可" || t === "yes") return "yes";
  if (t === "不可" || t === "no") return "no";
  return "";
}

export function petsToStored(ui: PetsUi): string {
  if (ui === "yes") return "可";
  if (ui === "no") return "不可";
  return "";
}

export type RentSubsidyUi = "" | "eligible" | "ineligible";

export function inferRentSubsidy(stored: string): RentSubsidyUi {
  const t = stored.trim();
  if (!t) return "";
  if (t === "不可申請" || t === "不可") return "ineligible";
  if (t === "可申請" || t === "可") return "eligible";
  return "";
}

export function rentSubsidyToStored(ui: RentSubsidyUi): string {
  if (ui === "ineligible") return "不可申請";
  if (ui === "eligible") return "可申請";
  return "";
}

export type ManagementFeeUi = { mode: "included" | "separate"; amount: string };

export function inferManagementFee(stored: string): ManagementFeeUi {
  const t = stored.trim();
  if (!t || t === "含在租金裡" || t.includes("含在租金")) {
    return { mode: "included", amount: "" };
  }
  return { mode: "separate", amount: t };
}

export function managementFeeToStored(ui: ManagementFeeUi): string {
  if (ui.mode === "included") return "含在租金裡";
  return ui.amount.trim();
}

export const PARKING_PRICE_INCLUDED_LABEL = "含在租金內";

export type ParkingPriceUi = { mode: "included" | "separate"; amount: string };

export function inferParkingPrice(stored: string): ParkingPriceUi {
  const t = stored.trim();
  if (!t || t === PARKING_PRICE_INCLUDED_LABEL || t.includes("含在租金")) {
    return { mode: "included", amount: "" };
  }
  return { mode: "separate", amount: t };
}

export function parkingPriceToStored(ui: ParkingPriceUi): string {
  if (ui.mode === "included") return PARKING_PRICE_INCLUDED_LABEL;
  return ui.amount.trim();
}

export const LAYOUT_OPEN_LABEL = "開放式格局";

export type LayoutUi = {
  rooms: string;
  living: string;
  bath: string;
  balcony: string;
  openLayout: boolean;
};

export const emptyLayoutUi = (): LayoutUi => ({
  rooms: "",
  living: "",
  bath: "",
  balcony: "",
  openLayout: false,
});

/** 由「2房2廳1衛1陽台開放式格局」等字串還原四格輸入。 */
export function parseLayoutStored(stored: string): LayoutUi {
  const t = stored.trim();
  if (!t) return emptyLayoutUi();
  const openLayout = t.includes(LAYOUT_OPEN_LABEL);
  const numericPart = t.replaceAll(LAYOUT_OPEN_LABEL, "").trim();
  const num = (re: RegExp) => numericPart.match(re)?.[1] ?? "";
  return {
    rooms: num(/(\d+(?:\.\d+)?)\s*房/),
    living: num(/(\d+(?:\.\d+)?)\s*廳/),
    bath: num(/(\d+(?:\.\d+)?)\s*衛/),
    balcony: num(/(\d+(?:\.\d+)?)\s*陽台/),
    openLayout,
  };
}

export function layoutUiToStored(ui: LayoutUi): string {
  const parts: string[] = [];
  const r = ui.rooms.trim();
  const l = ui.living.trim();
  const b = ui.bath.trim();
  const y = ui.balcony.trim();
  if (r) parts.push(`${r}房`);
  if (l) parts.push(`${l}廳`);
  if (b) parts.push(`${b}衛`);
  if (y) parts.push(`${y}陽台`);
  let value = parts.join("");
  if (ui.openLayout) {
    value = value ? `${value}${LAYOUT_OPEN_LABEL}` : LAYOUT_OPEN_LABEL;
  }
  return value;
}
