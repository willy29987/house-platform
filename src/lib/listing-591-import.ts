import "server-only";

import { EQUIPMENT_ITEMS, FURNITURE_ITEMS } from "@/lib/furniture-appliance-value";
import { extract591ListingId, resolve591IdFromUrlOrId } from "@/lib/listing-591-id";
import { is591ListingUrl, normalize591ListingUrl } from "@/lib/owner-tracking-listing-checks";
import { PROPERTY_TYPE_OPTIONS, type PropertyTypeOption } from "@/lib/property-type-label";
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
  propertyType: PropertyTypeOption | "";
  areaPing: string;
  rooms: string;
  livingRooms: string;
  bathrooms: string;
  balconies: string;
  floor: string;
  totalFloors: string;
  managementFee: string;
  otherFees: string;
  securityDeposit: string;
  availableFrom: string;
  petsAllowed: "" | "yes" | "no";
  specialMatters: string;
  images: string[];
  coverImage: string;
  furnitureItems: string[];
  equipmentItems: string[];
  contactName: string;
  contactPhone: string;
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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
  return "";
}

function firstText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const direct = textOf(record[key]);
    if (direct) return direct;
  }
  for (const nested of Object.values(record)) {
    const child = asRecord(nested);
    if (!child) continue;
    for (const key of keys) {
      const found = textOf(child[key]);
      if (found) return found;
    }
  }
  return "";
}

function findDetailNode(root: unknown): Record<string, unknown> | null {
  const stack: unknown[] = [root];
  let best: Record<string, unknown> | null = null;
  let bestScore = 0;
  let seen = 0;
  while (stack.length > 0 && seen < 800) {
    const current = stack.pop();
    seen += 1;
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 30)) stack.push(item);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    let score = 0;
    if (firstText(record, ["title", "address", "cases_name"]).length > 1) score += 2;
    if (firstText(record, ["price", "priceValue", "price_value"])) score += 2;
    if (firstText(record, ["area", "areaPing", "house_area"])) score += 1;
    if (firstText(record, ["room", "layout", "floor"])) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return bestScore >= 4 ? best : null;
}

function normalizeCityName(raw: string): string {
  return raw.trim().replaceAll("臺", "台");
}

function matchRegion(cityRaw: string, districtRaw: string, addressRaw: string) {
  const cityName = normalizeCityName(cityRaw);
  const districtName = districtRaw.trim();
  const address = addressRaw.trim();
  const city =
    TAIWAN_REGIONS.find((region) => cityName.includes(region.city) || address.includes(region.city)) ??
    null;
  const district =
    city?.districts.find((item) => districtName.includes(item) || address.includes(item)) ?? "";
  return { city: city?.city ?? "", district };
}

function propertyTypeFromLabels(labels: string[]): PropertyTypeOption | "" {
  const text = labels.join(" ");
  const rules: Array<[PropertyTypeOption, string[]]> = [
    ["ELEVATOR_BUILDING", ["電梯大樓", "華廈"]],
    ["APARTMENT", ["公寓"]],
    ["HOUSE", ["透天", "別墅"]],
    ["STUDIO", ["獨立套房"]],
    ["SUITE", ["分租套房", "雅房", "套房"]],
    ["OFFICE", ["辦公"]],
    ["SHOP", ["店面", "攤位"]],
  ];
  for (const [type, words] of rules) {
    if (words.some((word) => text.includes(word))) return type;
  }
  return "";
}

function splitFloor(raw: string): { floor: string; totalFloors: string } {
  const text = raw.replace(/樓/g, "");
  const pair = text.match(/(\d+)\s*[/／]\s*(\d+)/);
  if (pair) return { floor: pair[1] ?? "", totalFloors: pair[2] ?? "" };
  const one = text.match(/(\d+)/);
  return { floor: one?.[1] ?? "", totalFloors: "" };
}

function layoutCounts(record: Record<string, unknown>, layoutText: string) {
  const fromFields = {
    rooms: firstText(record, ["room", "rooms"]),
    livingRooms: firstText(record, ["hall", "livingRoom", "living"]),
    bathrooms: firstText(record, ["toilet", "bathroom", "bathrooms"]),
    balconies: firstText(record, ["balcony", "balconies"]),
  };
  if (Object.values(fromFields).some(Boolean)) return fromFields;
  const pick = (label: string) => layoutText.match(new RegExp(`(\\d+)\\s*${label}`))?.[1] ?? "";
  return {
    rooms: pick("房"),
    livingRooms: pick("廳"),
    bathrooms: pick("衛"),
    balconies: pick("陽"),
  };
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

function yesNo(raw: string): "" | "yes" | "no" {
  if (!raw) return "";
  if (/不可|禁止|不允許|不准/.test(raw)) return "no";
  if (/可|允許|歡迎|yes/i.test(raw)) return "yes";
  return "";
}

function depositText(raw: string): string {
  if (/兩|二|2\s*個/.test(raw)) return "2個月";
  return raw.trim();
}

function availableText(raw: string): string {
  if (/隨時|即可|立即/.test(raw)) return "隨時可遷入";
  const date = raw.match(/(20\d{2})[./年-](\d{1,2})[./月-](\d{1,2})/);
  if (!date) return "";
  const month = date[2]?.padStart(2, "0");
  const day = date[3]?.padStart(2, "0");
  return `${date[1]}-${month}-${day}`;
}

function collectImages(root: unknown): string[] {
  const found: string[] = [];
  const stack: unknown[] = [root];
  let seen = 0;
  while (stack.length > 0 && seen < 800 && found.length < 12) {
    const current = stack.pop();
    seen += 1;
    if (typeof current === "string" && /^https?:\/\/.+\.(?:jpe?g|png|webp)(?:\?|$)/i.test(current)) {
      if (!found.includes(current)) found.push(current);
      continue;
    }
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 40)) stack.push(item);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    for (const value of Object.values(record)) stack.push(value);
  }
  return found;
}

function collectLabels(root: unknown): string[] {
  const labels: string[] = [];
  const stack: unknown[] = [root];
  let seen = 0;
  while (stack.length > 0 && seen < 400) {
    const current = stack.pop();
    seen += 1;
    if (typeof current === "string") {
      const text = current.trim();
      if (text && text.length <= 12) labels.push(text);
      continue;
    }
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 40)) stack.push(item);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    for (const [key, value] of Object.entries(record)) {
      if (/contain|fixture|facility|equipment|furniture|provide|label|name/i.test(key)) {
        stack.push(value);
      }
    }
  }
  return labels;
}

const KNOWN_KEYS = [
  "title",
  "cases_name",
  "address",
  "price",
  "priceValue",
  "price_value",
  "regionName",
  "region",
  "city",
  "sectionName",
  "section",
  "district",
  "streetName",
  "street",
  "addr",
  "communityName",
  "community",
  "kindStr",
  "kindName",
  "kind",
  "shapeStr",
  "shapeName",
  "shape",
  "layout",
  "layoutStr",
  "room",
  "rooms",
  "hall",
  "livingRoom",
  "toilet",
  "bathroom",
  "balcony",
  "area",
  "areaPing",
  "house_area",
  "floor",
  "floorStr",
  "allfloor",
  "allFloor",
  "totalFloor",
  "manageprice",
  "managePrice",
  "priceadd",
  "deposit",
  "depositStr",
  "cometime",
  "comeTime",
  "pet",
  "petStr",
  "remark",
  "desc",
  "description",
  "linkman",
  "linkMan",
  "mobile",
  "phone",
] as const;

function flattenKnown(root: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const stack: unknown[] = [root];
  let seen = 0;
  while (stack.length > 0 && seen < 800) {
    const current = stack.pop();
    seen += 1;
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 20)) stack.push(item);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    for (const key of KNOWN_KEYS) {
      if (out[key]) continue;
      const value = textOf(record[key]);
      if (value) out[key] = value;
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return out;
}

export function map591DetailToDraft(
  detail: Record<string, unknown>,
  listingType: "RENT" | "SALE",
  source591Url: string,
  imageRoot: unknown = detail,
): Listing591ImportDraft {
  const title = firstText(detail, ["title", "cases_name", "address"]);
  const cityRaw = firstText(detail, ["regionName", "region", "city"]);
  const districtRaw = firstText(detail, ["sectionName", "section", "district"]);
  const street = firstText(detail, ["streetName", "street", "addr", "address"]);
  const region = matchRegion(cityRaw, districtRaw, `${cityRaw}${districtRaw}${street}`);
  let address = street;
  if (region.city) address = address.replace(region.city, "");
  if (region.district) address = address.replace(region.district, "");
  address = address.replace(/^[\s,，]+/, "").trim();

  const layoutText = firstText(detail, ["layout", "layoutStr"]);
  const counts = layoutCounts(detail, layoutText);
  const floors = splitFloor(firstText(detail, ["floor", "floorStr", "allfloor"]));
  const totalFromField = firstText(detail, ["allfloor", "allFloor", "totalFloor"]);
  const labels = [
    firstText(detail, ["kindStr", "kindName", "kind"]),
    firstText(detail, ["shapeStr", "shapeName", "shape"]),
    ...collectLabels(detail),
  ];
  const propertyType = propertyTypeFromLabels(labels);
  const images = collectImages(imageRoot);
  const facilityText = labels.join(" ");

  return {
    listingType,
    source591Url,
    title,
    price: priceForForm(firstText(detail, ["price", "priceValue", "price_value"]), listingType),
    city: region.city,
    district: region.district,
    address,
    community: firstText(detail, ["communityName", "community", "cases_name"]),
    propertyType: (PROPERTY_TYPE_OPTIONS as readonly string[]).includes(propertyType) ? propertyType : "",
    areaPing: firstText(detail, ["area", "areaPing", "house_area"]).replace(/坪/g, ""),
    rooms: counts.rooms,
    livingRooms: counts.livingRooms,
    bathrooms: counts.bathrooms,
    balconies: counts.balconies,
    floor: floors.floor,
    totalFloors: totalFromField.replace(/\D/g, "") || floors.totalFloors,
    managementFee: firstText(detail, ["manageprice", "managePrice", "managementFee"]),
    otherFees: firstText(detail, ["priceadd", "priceAdd", "otherFee"]),
    securityDeposit: depositText(firstText(detail, ["deposit", "depositStr"])),
    availableFrom: availableText(firstText(detail, ["cometime", "comeTime", "availableFrom"])),
    petsAllowed: yesNo(firstText(detail, ["pet", "petStr"])),
    specialMatters: firstText(detail, ["remark", "desc", "description"]).slice(0, 2000),
    images,
    coverImage: images[0] ?? "",
    furnitureItems: FURNITURE_ITEMS.filter((item) => facilityText.includes(item)),
    equipmentItems: EQUIPMENT_ITEMS.filter((item) => facilityText.includes(item)),
    contactName: firstText(detail, ["linkman", "linkMan", "contact"]),
    contactPhone: firstText(detail, ["mobile", "phone", "telephone"]).replace(/[^\d-]/g, ""),
  };
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
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function embeddedJson(html: string): unknown[] {
  const found: unknown[] = [];
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (next?.[1]) {
    try {
      found.push(JSON.parse(next[1]) as unknown);
    } catch {
      /* ignore */
    }
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      found.push(JSON.parse(match[1] ?? "") as unknown);
    } catch {
      /* ignore */
    }
  }
  return found;
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
  const endpoints =
    listingType === "SALE"
      ? [
          `https://bff.591.com.tw/v1/house/sale/detail?id=${id}`,
          `https://bff-house.591.com.tw/v1/web/sale/detail?id=${id}`,
        ]
      : [
          `https://bff.591.com.tw/v1/house/rent/detail?id=${id}`,
          `https://bff-house.591.com.tw/v1/web/rent/detail?id=${id}`,
        ];

  for (const endpoint of endpoints) {
    const json = await readJson(endpoint, referer).catch(() => null);
    if (json) {
      const detail = { ...flattenKnown(json), ...(findDetailNode(json) ?? {}) };
      if (firstText(detail, ["title", "address"]) && firstText(detail, ["price", "area", "room"])) {
        return map591DetailToDraft(detail, listingType, source591Url, json);
      }
    }
  }

  const page = await fetch(source591Url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html",
      "Accept-Language": "zh-TW,zh;q=0.9",
      Referer: referer,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (page?.ok) {
    const html = await page.text();
    for (const json of embeddedJson(html)) {
      const detail = { ...flattenKnown(json), ...(findDetailNode(json) ?? {}) };
      if (firstText(detail, ["title", "address"])) {
        return map591DetailToDraft(detail, listingType, source591Url, json);
      }
    }
  }

  throw new Error("讀不到這則 591 的欄位。請確認連結還在刊登，或改為手動填寫。");
}
