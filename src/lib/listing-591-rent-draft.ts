/** 本站租賃物件 → 591 租賃刊登可複製草稿（人工貼上用） */

import { formatFurnitureAndEquipmentZh } from "@/lib/furniture-appliance-value";
import { resolve591IdFromUrlOrId } from "@/lib/listing-591-id";
import { LAYOUT_OPEN_LABEL } from "@/lib/owner-tracking-form-ui";
import { PARKING_TYPE_LABELS } from "@/lib/parking-type-label";
import { PROPERTY_TYPE_LABEL, type PropertyTypeOption } from "@/lib/property-type-label";

export type Listing591RentDraftField = {
  id: string;
  label: string;
  value: string;
  group: string;
};

export type Listing591RentDraftInput = {
  title: string;
  city: string;
  district: string;
  address: string;
  community: string;
  propertyType: string;
  price: string;
  managementFee: string;
  otherFees: string;
  securityDeposit: string;
  availableFrom: string;
  shortTermRent: string;
  serviceFee: string;
  areaPing: string;
  areaMain: string;
  areaAncillary: string;
  rooms: string;
  livingRooms: string;
  bathrooms: string;
  balconies: string;
  layoutOpen: boolean;
  floor: string;
  totalFloors: string;
  roomNumber: string;
  parkingType: string | null;
  parkingRent: string;
  parkingSpaceInfo: string;
  areaParkingSpace: string;
  petsAllowed: "" | "yes" | "no";
  rentSubsidy: "" | "yes" | "no";
  taxDeductible: "" | "yes" | "no";
  canRegisterAddress: "" | "yes" | "no";
  viewingMethod: "" | "KEY" | "OWNER_APPOINTMENT";
  mrtLine: string;
  mrtStation: string;
  features: string[];
  specialMatters: string;
  furnitureItems: string[];
  equipmentItems: string[];
  contactName: string;
  contactPhone: string;
  coverImage: string;
  images: string[];
  videoUrl: string;
  source591Url: string;
  siteListingUrl?: string;
};

function triZh(v: "" | "yes" | "no"): string {
  if (v === "yes") return "可以";
  if (v === "no") return "不可以";
  return "";
}

function viewingZh(v: "" | "KEY" | "OWNER_APPOINTMENT"): string {
  if (v === "KEY") return "有鑰匙，隨時可帶看";
  if (v === "OWNER_APPOINTMENT") return "需約屋主時間";
  return "";
}

function layoutZh(input: Listing591RentDraftInput): string {
  if (input.layoutOpen) return LAYOUT_OPEN_LABEL;
  const parts = [
    input.rooms.trim() ? `${input.rooms.trim()}房` : "",
    input.livingRooms.trim() ? `${input.livingRooms.trim()}廳` : "",
    input.bathrooms.trim() ? `${input.bathrooms.trim()}衛` : "",
    input.balconies.trim() ? `${input.balconies.trim()}陽台` : "",
  ].filter(Boolean);
  return parts.join("");
}

function floorZh(input: Listing591RentDraftInput): string {
  const f = input.floor.trim();
  const t = input.totalFloors.trim();
  if (f && t) return `${f}/${t}樓`;
  if (f) return `${f}樓`;
  if (t) return `共${t}樓`;
  return "";
}

function parkingZh(input: Listing591RentDraftInput): string {
  if (!input.parkingType) return "無";
  const typeLabel = PARKING_TYPE_LABELS[input.parkingType] ?? input.parkingType;
  const bits = [typeLabel];
  if (input.parkingRent.trim()) bits.push(`租金 ${input.parkingRent.trim()} 元/月`);
  else bits.push("含在租金內或另議");
  if (input.parkingSpaceInfo.trim()) bits.push(`編號 ${input.parkingSpaceInfo.trim()}`);
  if (input.areaParkingSpace.trim()) bits.push(`${input.areaParkingSpace.trim()} 坪`);
  return bits.join(" · ");
}

function buildingAreaZh(input: Listing591RentDraftInput): string {
  const m = input.areaMain.trim();
  const a = input.areaAncillary.trim();
  if (m && a) {
    const total = Number(m) + Number(a);
    if (Number.isFinite(total)) {
      return `${Number.isInteger(total) ? total : total.toFixed(2)} 坪（主 ${m}＋附 ${a}）`;
    }
  }
  if (m) return `${m} 坪`;
  if (a) return `${a} 坪`;
  return "";
}

function pushField(
  fields: Listing591RentDraftField[],
  group: string,
  id: string,
  label: string,
  value: string,
) {
  const v = value.trim();
  if (!v) return;
  fields.push({ id, label, value: v, group });
}

/** 從本站表單狀態組出 591 租賃可貼欄位 */
export function build591RentDraftFields(input: Listing591RentDraftInput): Listing591RentDraftField[] {
  const fields: Listing591RentDraftField[] = [];
  const propertyLabel =
    PROPERTY_TYPE_LABEL[input.propertyType as PropertyTypeOption] ?? input.propertyType;

  pushField(fields, "基本", "title", "標題", input.title);
  pushField(fields, "基本", "city", "縣市", input.city);
  pushField(fields, "基本", "district", "行政區", input.district);
  pushField(fields, "基本", "address", "地址", input.address);
  pushField(fields, "基本", "community", "社區／大樓", input.community);
  pushField(fields, "基本", "propertyType", "物件類型", propertyLabel);
  pushField(fields, "基本", "fullAddress", "完整地址", `${input.city}${input.district}${input.address}`);

  pushField(
    fields,
    "租金",
    "price",
    "月租（元）",
    input.price.trim() ? `${input.price.trim()} 元/月` : "",
  );
  pushField(
    fields,
    "租金",
    "managementFee",
    "管理費",
    input.managementFee.trim()
      ? `${input.managementFee.trim()} 元/月`
      : input.price.trim()
        ? "免管理費或另議"
        : "",
  );
  pushField(fields, "租金", "otherFees", "其他費用", input.otherFees);
  pushField(fields, "租金", "securityDeposit", "押金", input.securityDeposit);
  pushField(fields, "租金", "availableFrom", "起租日", input.availableFrom);
  pushField(fields, "租金", "shortTermRent", "短租", input.shortTermRent);
  pushField(fields, "租金", "serviceFee", "服務費", input.serviceFee);

  pushField(fields, "格局", "layout", "格局", layoutZh(input));
  pushField(
    fields,
    "格局",
    "areaPing",
    "權狀坪數",
    input.areaPing.trim() ? `${input.areaPing.trim()} 坪` : "",
  );
  pushField(fields, "格局", "buildingArea", "主＋附屬", buildingAreaZh(input));
  pushField(fields, "格局", "floor", "樓層", floorZh(input));
  pushField(fields, "格局", "roomNumber", "房間號碼", input.roomNumber);
  pushField(fields, "格局", "parking", "車位", parkingZh(input));

  pushField(fields, "條件", "petsAllowed", "養寵物", triZh(input.petsAllowed));
  pushField(fields, "條件", "rentSubsidy", "租屋補助", triZh(input.rentSubsidy));
  pushField(fields, "條件", "taxDeductible", "報稅", triZh(input.taxDeductible));
  pushField(fields, "條件", "canRegisterAddress", "入戶籍", triZh(input.canRegisterAddress));
  pushField(fields, "條件", "viewingMethod", "帶看方式", viewingZh(input.viewingMethod));

  const mrt = [input.mrtLine.trim(), input.mrtStation.trim()].filter(Boolean).join(" ");
  pushField(fields, "交通", "mrt", "捷運", mrt);

  const amenity = formatFurnitureAndEquipmentZh({
    furnitureItems: input.furnitureItems,
    equipmentItems: input.equipmentItems,
  });
  if (amenity && amenity !== "— / —" && amenity !== "未填 / 未填") {
    pushField(fields, "設備", "furnitureEquipment", "家具／設備", amenity);
  }
  if (input.furnitureItems.length) {
    pushField(fields, "設備", "furnitureItems", "家具項目", input.furnitureItems.join("、"));
  }
  if (input.equipmentItems.length) {
    pushField(fields, "設備", "equipmentItems", "設備項目", input.equipmentItems.join("、"));
  }

  const features = input.features.map((f) => f.trim()).filter(Boolean);
  if (features.length) {
    pushField(fields, "文案", "features", "物件特色", features.map((f, i) => `${i + 1}. ${f}`).join("\n"));
  }
  pushField(fields, "文案", "specialMatters", "特別事項", input.specialMatters);

  const description = [
    input.title.trim() ? `【${input.title.trim()}】` : "",
    [
      layoutZh(input),
      input.areaPing.trim() ? `${input.areaPing.trim()} 坪` : "",
      floorZh(input),
      propertyLabel,
    ]
      .filter(Boolean)
      .join(" · "),
    input.price.trim() ? `租金 ${input.price.trim()} 元/月` : "",
    input.securityDeposit.trim() ? `押金 ${input.securityDeposit.trim()}` : "",
    input.availableFrom.trim() ? `起租 ${input.availableFrom.trim()}` : "",
    parkingZh(input) !== "無" ? `車位：${parkingZh(input)}` : "",
    mrt ? `捷運：${mrt}` : "",
    features.length ? `特色：\n${features.map((f) => `・${f}`).join("\n")}` : "",
    input.specialMatters.trim() ? `備註：${input.specialMatters.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  pushField(fields, "文案", "description", "建議說明文（可貼 591 詳情）", description);

  pushField(fields, "聯絡", "contactName", "聯絡人", input.contactName);
  pushField(fields, "聯絡", "contactPhone", "聯絡電話", input.contactPhone);

  const photos = [
    ...(input.coverImage.trim() ? [input.coverImage.trim()] : []),
    ...input.images.map((u) => u.trim()).filter(Boolean),
  ];
  const uniquePhotos = [...new Set(photos)];
  if (uniquePhotos.length) {
    pushField(fields, "媒體", "photos", "照片網址（逐張複製上傳）", uniquePhotos.join("\n"));
    pushField(fields, "媒體", "photoCount", "照片張數", String(uniquePhotos.length));
  }
  pushField(fields, "媒體", "videoUrl", "影片網址", input.videoUrl);

  if (input.siteListingUrl?.trim()) {
    pushField(fields, "對照", "siteListingUrl", "本站物件網址", input.siteListingUrl.trim());
  }
  const source591 = resolve591IdFromUrlOrId(input.source591Url);
  if (source591.url || source591.id) {
    pushField(fields, "對照", "source591", "既有 591 連結／編號", source591.url || source591.id || "");
  }

  return fields;
}

export function format591RentDraftPlainText(fields: Listing591RentDraftField[]): string {
  const lines: string[] = ["【591 租賃刊登草稿】", "（請人工核對後貼到 591 租賃後台）", ""];
  let lastGroup = "";
  for (const f of fields) {
    if (f.group !== lastGroup) {
      if (lastGroup) lines.push("");
      lines.push(`— ${f.group} —`);
      lastGroup = f.group;
    }
    if (f.value.includes("\n")) {
      lines.push(`${f.label}：`);
      lines.push(f.value);
    } else {
      lines.push(`${f.label}：${f.value}`);
    }
  }
  return lines.join("\n");
}
