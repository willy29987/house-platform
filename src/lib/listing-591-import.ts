import "server-only";

import { EQUIPMENT_ITEMS, FURNITURE_ITEMS } from "@/lib/furniture-appliance-value";
import { extract591ListingId, resolve591IdFromUrlOrId } from "@/lib/listing-591-id";
import { getMrtStationsForLine, MRT_LINE_OPTIONS } from "@/lib/mrt-stations";
import { is591ListingUrl, normalize591ListingUrl } from "@/lib/owner-tracking-listing-checks";
import { PARKING_TYPE_LABELS, PARKING_TYPE_OPTIONS } from "@/lib/parking-type-label";
import {
  buildingTypeFromShape,
  houseConditionFromKind,
  ownerContactFromTexts,
  skipsLayout,
  type BuildingTypeOption,
  type HouseConditionOption,
} from "@/lib/house-fields";
import { TAIWAN_REGIONS } from "@/lib/taiwan-regions";

export type Listing591ImportDraft = {
  listingType: "RENT" | "SALE";
  source591Url: string;
  title: string;
  price: string;
  city: string;
  district: string;
  address: string;
  community: string;
  propertyType: BuildingTypeOption | "";
  houseCondition: HouseConditionOption | "";
  areaPing: string;
  areaParkingSpace: string;
  rooms: string;
  livingRooms: string;
  bathrooms: string;
  balconies: string;
  floor: string;
  totalFloors: string;
  managementFee: string;
  /** 有讀到管理費（含 0／含在租金內）才覆寫表單 */
  managementFeeSet: boolean;
  otherFees: string;
  securityDeposit: string;
  availableFrom: string;
  petsAllowed: "" | "yes" | "no";
  rentSubsidy: "" | "yes" | "no";
  taxDeductible: "" | "yes" | "no";
  canRegisterAddress: "" | "yes" | "no";
  /** 特殊事項先不帶入 */
  specialMatters: string;
  images: string[];
  coverImage: string;
  furnitureItems: string[];
  equipmentItems: string[];
  /** 有讀到 591 設備勾選才覆寫；沒讀到就留著表單原勾選 */
  facilitiesKnown: boolean;
  parkingType: string;
  parkingKnown: boolean;
  parkingPriceMode: "" | "included" | "separate";
  parkingRent: string;
  parkingPrice: string;
  parkingIncluded: "" | "yes" | "no";
  mrtLine: string;
  mrtStation: string;
  contactName: string;
  contactPhone: string;
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MRT_WALK_METERS = 700;

const KIND_BY_CODE: Record<string, string> = {
  "1": "整層住家",
  "2": "獨立套房",
  "3": "分租套房",
  "4": "雅房",
  "5": "店面",
  "6": "辦公",
  "7": "廠房",
  "12": "住辦",
};

const PARKING_CODE_RULES: Array<[string, string[]]> = [
  ["LIFT_MECHANICAL", ["升降機械"]],
  ["LIFT_FLAT", ["升降平面"]],
  ["RAMP_MECHANICAL", ["坡道機械"]],
  ["FLAT_RAMP", ["坡道平面"]],
  ["STORAGE", ["倉儲"]],
  ["FRONT_DOOR", ["門口可停", "門口停車"]],
];

const EQUIPMENT_BY_KEY: Record<string, (typeof EQUIPMENT_ITEMS)[number]> = {
  fridge: "冰箱",
  washer: "洗衣機",
  tv: "電視",
  cold: "冷氣",
  heater: "熱水器",
  fourth: "第四台",
  net: "網路",
  gas: "天然瓦斯",
};

const FURNITURE_BY_KEY: Record<string, readonly (typeof FURNITURE_ITEMS)[number][]> = {
  bed: ["床"],
  closet: ["衣櫃"],
  sofa: ["沙發"],
  table_chairs: ["桌子", "椅子"],
};

function listingTypeFromUrl(url: string): "RENT" | "SALE" {
  const u = url.toLowerCase();
  if (u.includes("sale.591") || u.includes("sale-detail") || /\/sale(\/|$)/.test(u)) return "SALE";
  return "RENT";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function rowsOf(value: unknown): Array<{ key: string; name: string; value: string }> {
  if (!Array.isArray(value)) return [];
  const rows: Array<{ key: string; name: string; value: string }> = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const rowValue = textOf(record.value);
    if (!rowValue) continue;
    rows.push({ key: textOf(record.key), name: textOf(record.name), value: rowValue });
  }
  return rows;
}

function rowText(rows: Array<{ key: string; name: string; value: string }>, ...names: string[]): string {
  for (const name of names) {
    const found = rows.find((row) => row.key === name || row.name === name);
    if (found?.value) return found.value;
  }
  return "";
}

function normalizeCityName(raw: string): string {
  return raw.trim().replaceAll("臺", "台");
}

function matchRegion(cityRaw: string, districtRaw: string, addressRaw: string) {
  const cityName = normalizeCityName(cityRaw);
  const districtName = districtRaw.trim();
  const address = addressRaw.trim();
  const city =
    TAIWAN_REGIONS.find((region) => cityName.includes(region.city) || address.includes(region.city)) ?? null;
  const district = city?.districts.find((item) => districtName.includes(item) || address.includes(item)) ?? "";
  return { city: city?.city ?? "", district };
}

function stripRegion(address: string, city: string, district: string): string {
  let next = address.trim();
  if (city) next = next.replace(city, "");
  if (district) next = next.replace(district, "");
  return next.replace(/^[\s,，\-]+/, "").trim();
}

function floorToken(token: string): string {
  const cleaned = token.trim().replace(/[Ff樓層]/g, "");
  const basement = cleaned.match(/^(?:B|地下)(\d+)$/i);
  if (basement?.[1]) return `-${basement[1]}`;
  return cleaned.match(/^(\d+)$/)?.[1] ?? "";
}

function splitFloor(raw: string): { floor: string; totalFloors: string } {
  const text = raw.trim();
  if (!text || text === "-" || text === "—") return { floor: "", totalFloors: "" };
  const pair = text.match(/([^/／]+)\s*[/／]\s*([^/／]+)/);
  if (pair) {
    return { floor: floorToken(pair[1] ?? ""), totalFloors: floorToken(pair[2] ?? "") };
  }
  return { floor: floorToken(text), totalFloors: "" };
}

function layoutCounts(layoutText: string) {
  const pick = (label: string) => layoutText.match(new RegExp(`(\\d+)\\s*${label}`))?.[1] ?? "";
  return {
    rooms: pick("房"),
    livingRooms: pick("廳"),
    bathrooms: pick("衛"),
    balconies: pick("陽"),
  };
}

/** 獨立套房、分租套房不帶格局。 */
function layoutForCondition(
  houseCondition: HouseConditionOption | "",
  counts: { rooms: string; livingRooms: string; bathrooms: string; balconies: string },
) {
  if (skipsLayout(houseCondition)) {
    return { rooms: "", livingRooms: "", bathrooms: "", balconies: "" };
  }
  return counts;
}

function contactFromLink(link: Record<string, unknown>): { name: string; phone: string } {
  const phoneRaw = textOf(link.mobile) || textOf(link.phone) || textOf(link.telephone) || textOf(link.tel);
  return ownerContactFromTexts(textOf(link.name), textOf(link.imName) || textOf(link.linkman), phoneRaw);
}

function priceForForm(raw: string, listingType: "RENT" | "SALE"): string {
  const cleaned = raw.replace(/[,，元]/g, "").trim();
  const wan = cleaned.match(/([\d.]+)\s*萬/);
  if (wan?.[1]) return String(Math.round(Number(wan[1])));
  const num = Number(cleaned.match(/[\d.]+/)?.[0] ?? "");
  if (!Number.isFinite(num) || num <= 0) return "";
  if (listingType === "SALE" && num >= 100000) return String(Math.round(num / 10000));
  return String(Math.round(num));
}

function feeAmount(raw: string): { set: boolean; amount: string } {
  const text = raw.trim();
  if (!text) return { set: false, amount: "" };
  if (/無|免|不含|沒有/.test(text) && !/\d/.test(text)) return { set: true, amount: "0" };
  if (/含/.test(text) && !/\d/.test(text)) return { set: true, amount: "0" };
  const num = text.replace(/[,，]/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!num?.[1]) return { set: false, amount: "" };
  return { set: true, amount: String(Math.round(Number(num[1]))) };
}

function yesNo(raw: string): "" | "yes" | "no" {
  if (!raw) return "";
  if (/不可|禁止|不允許|不准/.test(raw)) return "no";
  if (/可|允許|歡迎/.test(raw)) return "yes";
  return "";
}

function tagValues(data: Record<string, unknown>): string[] {
  if (!Array.isArray(data.tags)) return [];
  return data.tags
    .map((item) => textOf(asRecord(item)?.value))
    .filter(Boolean);
}

/** 591 標題下方標籤：有勾才會出現；沒出現視為未勾。 */
function tagYesNo(tags: string[], patterns: RegExp[]): "" | "yes" | "no" {
  if (!tags.length) return "";
  if (tags.some((tag) => patterns.some((re) => re.test(tag)))) return "yes";
  return "no";
}

function firstYes(...values: Array<"" | "yes" | "no">): "" | "yes" | "no" {
  if (values.includes("yes")) return "yes";
  if (values.includes("no")) return "no";
  return "";
}

function remarkPlain(data: Record<string, unknown>): string {
  const remark = asRecord(data.remark);
  const html = textOf(remark?.content);
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

/** 備註手打只往「可」加分，不因沒寫就標不可。 */
function remarkYes(text: string, patterns: RegExp[]): "" | "yes" {
  if (!text) return "";
  return patterns.some((re) => re.test(text)) ? "yes" : "";
}

function depositText(raw: string): string {
  if (/兩|二|2\s*個/.test(raw)) return "2個月";
  return raw.replace(/租金/g, "").trim();
}

function availableText(raw: string): string {
  if (/隨時|即可|立即/.test(raw)) return "隨時可遷入";
  const date = raw.match(/(20\d{2})[./年-](\d{1,2})[./月-](\d{1,2})/);
  if (!date) return "";
  return `${date[1]}-${date[2]?.padStart(2, "0")}-${date[3]?.padStart(2, "0")}`;
}

function pingNumber(raw: string): string {
  const num = raw.replace(/[,，]/g, "").match(/(\d+(?:\.\d+)?)/);
  return num?.[1] ?? "";
}

function parkingCode(label: string): string {
  const text = label.trim();
  if (!text || /無車位|沒有車位|^無$/.test(text)) return "";
  for (const [code, words] of PARKING_CODE_RULES) {
    if (words.some((word) => text.includes(word))) return code;
  }
  for (const code of PARKING_TYPE_OPTIONS) {
    const name = PARKING_TYPE_LABELS[code];
    if (name && text.includes(name)) return code;
  }
  const named = text
    .split(/[，,、]/)
    .map((part) => part.trim())
    .find((part) => /平面|機械|坡道|升降|倉儲|門口|車位/.test(part) && !/坪|元|含|售/.test(part));
  if (named) return named.replace(/^\d+/, "").trim();
  const short = text.replace(/^\d+/, "").trim();
  return short.length > 12 ? "有車位" : short;
}

function stationKey(name: string): string {
  return name.replaceAll("臺", "台").replace(/\s/g, "").replace(/捷運/g, "").replace(/站$/, "");
}

function collectSubway(root: unknown): Array<{ name: string; distance: number }> {
  const found: Array<{ name: string; distance: number }> = [];
  const stack: unknown[] = [root];
  let seen = 0;
  while (stack.length > 0 && seen < 600) {
    const current = stack.pop();
    seen += 1;
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    const type = textOf(record.type);
    const name = textOf(record.name);
    const distance = Number(textOf(record.distance));
    if ((type === "subway" || type === "subway_station") && name && Number.isFinite(distance) && distance > 0) {
      found.push({ name, distance });
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  const nearest = new Map<string, { name: string; distance: number }>();
  for (const item of found) {
    const key = stationKey(item.name);
    const prev = nearest.get(key);
    if (!prev || item.distance < prev.distance) nearest.set(key, item);
  }
  return [...nearest.values()];
}

function nearestMrt(stations: Array<{ name: string; distance: number }>): { mrtLine: string; mrtStation: string } {
  const within = stations.filter((item) => item.distance <= MRT_WALK_METERS).sort((a, b) => a.distance - b.distance);
  const nearest = within[0];
  if (!nearest) return { mrtLine: "", mrtStation: "" };
  const key = stationKey(nearest.name);
  const lines = MRT_LINE_OPTIONS.filter((line) =>
    getMrtStationsForLine(line).some((station) => stationKey(station) === key),
  );
  if (lines.length === 0) return { mrtLine: "", mrtStation: "" };
  let line = lines[0] ?? "";
  if (lines.length > 1) {
    let bestScore = -1;
    for (const candidate of lines) {
      const names = new Set(getMrtStationsForLine(candidate).map(stationKey));
      const score = stations.filter((item) => names.has(stationKey(item.name))).length;
      if (score > bestScore) {
        bestScore = score;
        line = candidate;
      }
    }
  }
  const station = getMrtStationsForLine(line).find((item) => stationKey(item) === key) ?? "";
  if (!station) return { mrtLine: "", mrtStation: "" };
  return { mrtLine: line, mrtStation: station };
}

function mapFacilities(facility: unknown): {
  furnitureItems: string[];
  equipmentItems: string[];
  parkingLabel: string;
  balcony: string;
  known: boolean;
} {
  if (!Array.isArray(facility)) {
    return { furnitureItems: [], equipmentItems: [], parkingLabel: "", balcony: "", known: false };
  }
  const furniture = new Set<string>();
  const equipment = new Set<string>();
  let parkingLabel = "";
  let balcony = "";
  for (const item of facility) {
    const record = asRecord(item);
    if (!record) continue;
    const active = record.active === 1 || record.active === true || textOf(record.active) === "1";
    if (!active) continue;
    const key = textOf(record.key);
    const name = textOf(record.name).replace(/^\d+/, "").trim();
    const equipmentName = EQUIPMENT_BY_KEY[key] ?? EQUIPMENT_ITEMS.find((entry) => name === entry || name.includes(entry));
    if (equipmentName) equipment.add(equipmentName);
    const furnitureNames =
      FURNITURE_BY_KEY[key] ??
      (name === "桌椅" ? (["桌子", "椅子"] as const) : FURNITURE_ITEMS.filter((entry) => name === entry));
    for (const entry of furnitureNames) furniture.add(entry);
    if (key === "park" || name.includes("車位")) parkingLabel = textOf(record.name).trim() || name;
    if (name.includes("陽台") || key === "balcony") {
      balcony = textOf(record.name).match(/(\d+)/)?.[1] ?? "1";
    }
  }
  return {
    furnitureItems: FURNITURE_ITEMS.filter((item) => furniture.has(item)),
    equipmentItems: EQUIPMENT_ITEMS.filter((item) => equipment.has(item)),
    parkingLabel,
    balcony,
    known: true,
  };
}

function emptyDraft(listingType: "RENT" | "SALE", source591Url: string, images: string[]): Listing591ImportDraft {
  return {
    listingType,
    source591Url,
    title: "",
    price: "",
    city: "",
    district: "",
    address: "",
    community: "",
    propertyType: "",
    houseCondition: "",
    areaPing: "",
    areaParkingSpace: "",
    rooms: "",
    livingRooms: "",
    bathrooms: "",
    balconies: "",
    floor: "",
    totalFloors: "",
    managementFee: "",
    managementFeeSet: false,
    otherFees: "",
    securityDeposit: "",
    availableFrom: "",
    petsAllowed: "",
    rentSubsidy: "",
    taxDeductible: "",
    canRegisterAddress: "",
    specialMatters: "",
    images,
    coverImage: images[0] ?? "",
    furnitureItems: [],
    equipmentItems: [],
    facilitiesKnown: false,
    parkingType: "",
    parkingKnown: false,
    parkingPriceMode: "",
    parkingRent: "",
    parkingPrice: "",
    parkingIncluded: "",
    mrtLine: "",
    mrtStation: "",
    contactName: "",
    contactPhone: "",
  };
}

function galleryImages(payload: unknown): string[] {
  const data = asRecord(asRecord(payload)?.data) ?? asRecord(payload);
  const groups = Array.isArray(data?.list) ? data.list : [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    const record = asRecord(group);
    if (!record) continue;
    const key = textOf(record.key);
    const name = textOf(record.name);
    if (key !== "picture" && name !== "圖片") continue;
    const items = Array.isArray(record.items) ? record.items : [];
    const ordered = [...items].sort((a, b) => {
      const aCover = asRecord(a)?.isCover === 1 ? 1 : 0;
      const bCover = asRecord(b)?.isCover === 1 ? 1 : 0;
      return bCover - aCover;
    });
    for (const item of ordered) {
      const photo = asRecord(item);
      const url = textOf(photo?.photo) || textOf(photo?.origPhoto);
      if (!/^https?:\/\//i.test(url) || /\.(?:mp4|webm|mov)(?:\?|$)/i.test(url)) continue;
      const dedupe = url.replace(/![^/]+$/, "");
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      urls.push(url);
      if (urls.length >= 60) return urls;
    }
  }
  return urls;
}

function mapRentPayload(
  data: Record<string, unknown>,
  listingType: "RENT" | "SALE",
  source591Url: string,
  images: string[],
): Listing591ImportDraft | null {
  const info = rowsOf(data.info);
  const gtm = asRecord(data.gtm_detail_data) ?? {};
  const calc = asRecord(data.rent_calculation_data) ?? {};
  const position = asRecord(data.positionRound) ?? {};
  const service = asRecord(data.service) ?? {};
  const link = asRecord(data.linkInfo) ?? {};
  const crumbs = Array.isArray(data.breadcrumb) ? data.breadcrumb : [];
  const crumbName = (index: number) => textOf(asRecord(crumbs[index])?.name);
  const title = textOf(data.title) || textOf(gtm.item_name);
  if (!title && info.length === 0) return null;

  const kindName =
    rowText(info, "kind", "類型") ||
    textOf(gtm.kind_name) ||
    crumbName(2) ||
    KIND_BY_CODE[textOf(data.kind)] ||
    "";
  const shapeName = rowText(info, "shape", "型態") || textOf(gtm.shape_name);
  const floors = splitFloor(rowText(info, "floor", "樓層") || textOf(gtm.floor_name));
  const propertyType = buildingTypeFromShape(shapeName);
  const houseCondition = houseConditionFromKind(kindName);
  const counts = layoutForCondition(houseCondition, layoutCounts(rowText(info, "layout", "格局")));
  const facilities = mapFacilities(service.facility);
  const cityRaw = textOf(gtm.region_name) || crumbName(0);
  const districtRaw = textOf(gtm.section_name) || crumbName(1);
  const street = textOf(position.address);
  const region = matchRegion(cityRaw, districtRaw, `${cityRaw}${districtRaw}${street}`);
  const fee = feeAmount(textOf(calc.manage_fee_text) || textOf(calc.manage_fee));
  const costFee = rowText(rowsOf(asRecord(data.costData)?.data), "manageprice", "管理費");
  const management = fee.set ? fee : feeAmount(costFee);
  const parkingLabel = facilities.parkingLabel;
  const hasCarport = calc.price_has_carport === true || textOf(calc.price_has_carport) === "true";
  const carportText = textOf(calc.carport_price_text);
  const noParking = /無車位/.test(carportText) && !parkingLabel && !hasCarport;
  const parkingKnown = facilities.known || "price_has_carport" in calc || Boolean(carportText);
  const parkingType = noParking ? "" : parkingCode(parkingLabel) || (hasCarport ? "有車位" : "");
  const carportAmount = feeAmount(textOf(calc.carport_price) === "0" ? carportText : textOf(calc.carport_price) || carportText);
  const parkingSeparate = carportAmount.set && carportAmount.amount !== "0" && !/含/.test(carportText);
  const desc = Array.isArray(service.descData) ? service.descData : [];
  const descValue = (label: string) => {
    const row = desc.map(asRecord).find((item) => textOf(item?.label).includes(label));
    return textOf(row?.value);
  };
  const tags = tagValues(data);
  const remark = remarkPlain(data);
  const petsFromDesc = yesNo(descValue("寵物"));
  const petsFromTag = tagYesNo(tags, [/^可養寵物$/, /可養寵物/]);
  const rentSubsidy = firstYes(
    tagYesNo(tags, [/租金補貼/, /租屋補助/, /^可租補$/, /可申請.*租補/]),
    remarkYes(remark, [/可申請?\s*租金?補[貼助]/, /可租補/, /租金補貼/, /租屋補助/]),
  );
  const taxDeductible = firstYes(
    tagYesNo(tags, [/^可報稅$/, /可報稅/]),
    remarkYes(remark, [/可報稅/, /可申請報稅/, /願意報稅/]),
  );
  const canRegisterAddress = firstYes(
    tagYesNo(tags, [/^可入籍$/, /可入籍/, /可設籍/, /可登記戶籍/, /可入戶籍/]),
    remarkYes(remark, [/可入籍/, /可設籍/, /可入戶籍/, /可登記戶籍/]),
  );
  const mrt = nearestMrt(collectSubway(position));
  const community = textOf(position.communityName);
  const draft = emptyDraft(listingType, source591Url, images);
  return {
    ...draft,
    title,
    price: priceForForm(textOf(calc.rent_price) || textOf(data.price), listingType),
    city: region.city,
    district: region.district,
    address: stripRegion(street, region.city, region.district),
    community: community === "依現場名稱" ? "" : community,
    propertyType,
    houseCondition,
    areaPing: pingNumber(rowText(info, "area", "使用坪數") || textOf(gtm.area_name)),
    rooms: counts.rooms,
    livingRooms: counts.livingRooms,
    bathrooms: counts.bathrooms,
    balconies: counts.balconies || (skipsLayout(houseCondition) ? "" : facilities.balcony),
    floor: floors.floor,
    totalFloors: floors.totalFloors,
    managementFee: management.amount,
    managementFeeSet: management.set,
    securityDeposit: depositText(textOf(data.deposit) || textOf(calc.deposit)),
    availableFrom: availableText(descValue("遷入")),
    petsAllowed: firstYes(petsFromDesc, petsFromTag === "yes" ? "yes" : ""),
    rentSubsidy,
    taxDeductible,
    canRegisterAddress,
    furnitureItems: facilities.furnitureItems,
    equipmentItems: facilities.equipmentItems,
    facilitiesKnown: facilities.known,
    parkingType: parkingKnown ? parkingType : "",
    parkingKnown,
    parkingPriceMode: !parkingKnown || !parkingType ? "" : parkingSeparate ? "separate" : "included",
    parkingRent: parkingSeparate ? carportAmount.amount : "",
    mrtLine: mrt.mrtLine,
    mrtStation: mrt.mrtStation,
    contactName: contactFromLink(link).name,
    contactPhone: contactFromLink(link).phone,
  };
}

function mapSalePayload(
  data: Record<string, unknown>,
  listingType: "RENT" | "SALE",
  source591Url: string,
  images: string[],
): Listing591ImportDraft | null {
  const base = asRecord(data.baseInfo);
  if (!base) return null;
  const info = rowsOf(base.info);
  const address = asRecord(base.address) ?? {};
  const gtm = asRecord(data.gtm_detail_data) ?? {};
  const link = asRecord(data.linkInfo) ?? {};
  const title = textOf(base.title) || textOf(gtm.item_name);
  if (!title) return null;
  const kindName = rowText(info, "現況") || textOf(data.kindStr) || textOf(gtm.kind_name);
  const shapeName = rowText(info, "型態") || textOf(gtm.shape_name);
  const floors = splitFloor(rowText(info, "樓層") || textOf(gtm.floor_name));
  const propertyType = buildingTypeFromShape(shapeName);
  const houseCondition = houseConditionFromKind(kindName);
  const counts = layoutForCondition(houseCondition, layoutCounts(textOf(base.layout)));
  const cityRaw = textOf(address.region) || textOf(gtm.region_name);
  const districtRaw = textOf(address.section) || textOf(gtm.section_name);
  const street = [textOf(address.street), textOf(address.lane) ? `${textOf(address.lane)}巷` : "", textOf(address.alley) ? `${textOf(address.alley)}弄` : ""]
    .filter(Boolean)
    .join("");
  const number = textOf(address.hide_addr_detail) === "1" ? "" : textOf(address.addr_number);
  const fullStreet = `${street}${number ? `${number}號` : ""}`;
  const region = matchRegion(cityRaw, districtRaw, `${cityRaw}${districtRaw}${fullStreet}`);
  const management = feeAmount(rowText(info, "管理費"));
  const parkingRaw = textOf(base.parking);
  const parkingKnown = parkingRaw.length > 0;
  const noParking = /無車位|^無$|沒有/.test(parkingRaw);
  const parkingType = !parkingKnown || noParking ? "" : parkingCode(parkingRaw);
  const included = /已含|含售|含於/.test(parkingRaw);
  const separate = /另計|不含/.test(parkingRaw);
  const draft = emptyDraft(listingType, source591Url, images);
  return {
    ...draft,
    title,
    price: priceForForm(textOf(base.price), "SALE"),
    city: region.city,
    district: region.district,
    address: stripRegion(fullStreet, region.city, region.district),
    propertyType,
    houseCondition,
    areaPing: pingNumber(textOf(base.unitArea) || textOf(base.area)),
    areaParkingSpace: pingNumber(parkingRaw.includes("坪") ? parkingRaw : ""),
    rooms: counts.rooms,
    livingRooms: counts.livingRooms,
    bathrooms: counts.bathrooms,
    balconies: counts.balconies,
    floor: floors.floor,
    totalFloors: floors.totalFloors,
    managementFee: management.amount,
    managementFeeSet: management.set,
    parkingType,
    parkingKnown,
    parkingPriceMode: !parkingType ? "" : separate ? "separate" : "included",
    parkingIncluded: !parkingType ? "" : included ? "yes" : separate ? "no" : "",
    contactName: contactFromLink(link).name,
    contactPhone: contactFromLink(link).phone,
  };
}

function payloadData(json: unknown): Record<string, unknown> | null {
  const root = asRecord(json);
  if (!root) return null;
  const status = root.status;
  if (status === 0 || status === "0") return null;
  return asRecord(root.data) ?? root;
}

async function readJson(url: string, referer: string): Promise<unknown | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "zh-TW,zh;q=0.9",
      device: "pc",
      deviceid: "house-platform-import",
      Referer: referer,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function import591ListingFromUrl(raw: string): Promise<Listing591ImportDraft> {
  const trimmed = raw.trim();
  if (!is591ListingUrl(trimmed) && !extract591ListingId(trimmed)) {
    throw new Error("請貼上 591 物件連結");
  }
  const resolved = resolve591IdFromUrlOrId(trimmed);
  const source591Url = normalize591ListingUrl(trimmed) || resolved.url;
  const id = resolved.id;
  if (!source591Url || !id) throw new Error("這段內容裡沒有 591 物件編號");

  const listingType = listingTypeFromUrl(source591Url);
  const referer = listingType === "SALE" ? "https://sale.591.com.tw/" : "https://rent.591.com.tw/";
  const detailUrl =
    listingType === "SALE"
      ? `https://bff.591.com.tw/v1/house/sale/detail?id=${id}`
      : `https://bff-house.591.com.tw/v2/web/rent/detail?id=${id}`;
  const photoType = listingType === "SALE" ? "2" : "1";
  const photoUrl = `https://bff-house.591.com.tw/v1/ware/photos?id=${id}&type=${photoType}`;

  const [detailJson, photoJson] = await Promise.all([
    readJson(detailUrl, referer).catch(() => null),
    readJson(photoUrl, referer).catch(() => null),
  ]);
  const images = galleryImages(photoJson);
  const data = payloadData(detailJson);
  const draft = data
    ? listingType === "SALE"
      ? mapSalePayload(data, listingType, source591Url, images)
      : mapRentPayload(data, listingType, source591Url, images)
    : null;
  if (draft && (draft.title || draft.price)) return draft;
  throw new Error("讀不到這則 591 的欄位。請確認連結還在刊登，或改為手動填寫。");
}
