import { ListingType, PropertyType } from "@prisma/client";
import { z } from "zod";

const optionalNumber = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

const optionalNonNegative = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}, z.number().nonnegative().optional());

const optionalString = z.preprocess((val) => {
  if (val === null || val === undefined) return undefined;
  const s = String(val).trim();
  return s === "" ? undefined : s;
}, z.string().optional());

const optionalBoolean = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return undefined;
  return val;
}, z.boolean().optional());

const optionalBooleanOrDiscuss = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return undefined;
  if (val === "DISCUSS") return "DISCUSS" as const;
  return val;
}, z.union([z.boolean(), z.literal("DISCUSS")]).optional());

export const listingInputSchema = z.object({
  title: z.string().min(2, "標題至少需要 2 個字"),
  description: z.string().optional().default(""),
  features: z.array(z.string()).optional().default([]),
  city: z.string().min(1, "請選擇縣市"),
  district: z.string().min(1, "請選擇行政區"),
  address: z.string().min(3, "地址至少需要 3 個字"),
  price: z.coerce.number().int().positive("價格必須大於 0"),
  areaPing: z.coerce.number().positive("權狀坪數必須大於 0"),
  areaMain: optionalNonNegative,
  areaAncillary: optionalNonNegative,
  areaCommon: optionalNonNegative,
  areaLand: optionalNonNegative,
  areaParkingSpace: optionalNonNegative,
  parkingPrice: optionalNonNegative,
  parkingSpaceInfo: optionalString,
  parkingRent: optionalNonNegative,
  parkingType: optionalString,
  managementFee: optionalNonNegative,
  petsAllowed: optionalBoolean,
  taxDeductible: optionalBoolean,
  rentSubsidy: optionalBoolean,
  canRegisterAddress: optionalBoolean,
  viewingMethod: optionalString,
  community: optionalString,
  buildingAge: optionalNonNegative,
  orientation: optionalString,
  decorLevel: optionalString,
  usageZoning: optionalString,
  hasElevator: optionalBoolean,
  legalUsage: optionalString,
  parkingIncluded: optionalBoolean,
  mrtLine: optionalString,
  mrtStation: optionalString,
  videoUrl: optionalString,
  rooms: z.coerce.number().int().nonnegative("房數不能為負"),
  livingRooms: optionalNumber,
  balconies: optionalNumber,
  bathrooms: z.coerce.number().int().nonnegative("衛數不能為負"),
  floor: optionalNumber,
  totalFloors: optionalNumber,
  listingType: z.nativeEnum(ListingType),
  propertyType: z.nativeEnum(PropertyType),
  coverImage: optionalString,
  images: z.array(z.string()).optional(),
  contactName: z.string().min(1, "請填寫聯絡人"),
  contactPhone: z.string().min(8, "聯絡電話至少 8 碼"),
  ownerIdCardUrl: optionalString,
  furnitureProvided: optionalBooleanOrDiscuss,
  applianceProvided: optionalBooleanOrDiscuss,
  shortTermRent: optionalString,
  serviceFee: optionalString,
  registrationUse: optionalString,
  securityDeposit: optionalString,
  availableFrom: optionalString,
  householdsPerFloor: optionalString,
  isPublished: z.boolean().optional(),
});

export type ListingInput = z.infer<typeof listingInputSchema>;
