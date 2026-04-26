import { ListingType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ListingCard = {
  id: string;
  title: string;
  city: string;
  district: string;
  address: string;
  community: string | null;
  price: number;
  areaPing: number;
  rooms: number;
  livingRooms: number | null;
  balconies: number | null;
  bathrooms: number;
  floor: number | null;
  totalFloors: number | null;
  areaParkingSpace: number | null;
  buildingAge: number | null;
  hasElevator: boolean | null;
  mrtLine: string | null;
  mrtStation: string | null;
  listingType: ListingType;
  propertyType: string;
  coverImage: string | null;
  createdAt: Date;
};

export type ListingDetail = ListingCard & {
  description: string;
  features: string[];
  images: string[];
  livingRooms: number | null;
  balconies: number | null;
  areaMain: number | null;
  areaAncillary: number | null;
  parkingSpaceInfo: string | null;
  parkingRent: number | null;
  parkingType: string | null;
  managementFee: number | null;
  petsAllowed: boolean | null;
  taxDeductible: boolean | null;
  rentSubsidy: boolean | null;
  canRegisterAddress: boolean | null;
  viewingMethod: string | null;
  community: string | null;
  buildingAge: number | null;
  orientation: string | null;
  decorLevel: string | null;
  usageZoning: string | null;
  hasElevator: boolean | null;
  legalUsage: string | null;
  parkingIncluded: boolean | null;
  videoUrl: string | null;
  // NOTE: mrtLine/mrtStation already on ListingCard (inherited)
  contactName: string;
  contactPhone: string;
  ownerIdCardUrl: string | null;
};

export function maskAddress(address: string) {
  const match = address.match(/^(.*?)(\d+\s*號.*)$/);
  if (!match) return address.trim();
  return match[1].trim();
}

export type AdminListingDetail = ListingDetail & {
  isPublished: boolean;
};

export type ListingFilters = {
  listingType?: ListingType;
  city?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type InquiryItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  name: string;
  phone: string;
  message: string | null;
  contactTime: string | null;
  isHandled: boolean;
  handledAt: Date | null;
  createdAt: Date;
};

export type AdminListing = {
  id: string;
  title: string;
  listingType: ListingType;
  city: string;
  district: string;
  address: string;
  community: string | null;
  price: number;
  isPublished: boolean;
  createdAt: Date;
};

const mockListings: ListingCard[] = [
  {
    id: "mock-rent-1",
    title: "中山捷運旁兩房電梯宅",
    city: "台北市",
    district: "中山區",
    address: "南京東路二段 100 號",
    community: "中山捷運宅",
    price: 32000,
    areaPing: 22,
    rooms: 2,
    livingRooms: 1,
    balconies: 1,
    bathrooms: 1,
    floor: 8,
    totalFloors: 14,
    areaParkingSpace: null,
    buildingAge: 12,
    hasElevator: true,
    mrtLine: "松山新店線",
    mrtStation: "中山站",
    listingType: ListingType.RENT,
    propertyType: "APARTMENT",
    coverImage: null,
    createdAt: new Date("2026-04-01"),
  },
  {
    id: "mock-sale-1",
    title: "高雄美術館景觀三房",
    city: "高雄市",
    district: "鼓山區",
    address: "美術東二路 80 號",
    community: "美術館雙子星",
    price: 13800000,
    areaPing: 45,
    rooms: 3,
    livingRooms: 2,
    balconies: 2,
    bathrooms: 2,
    floor: 15,
    totalFloors: 24,
    areaParkingSpace: 8.5,
    buildingAge: 6,
    hasElevator: true,
    mrtLine: null,
    mrtStation: null,
    listingType: ListingType.SALE,
    propertyType: "APARTMENT",
    coverImage: null,
    createdAt: new Date("2026-04-08"),
  },
];

const mockListingDetails: Record<string, ListingDetail> = {
  "mock-rent-1": {
    id: "mock-rent-1",
    title: "中山捷運旁兩房電梯宅",
    description: "",
    features: ["鄰近捷運 5 分鐘", "採光通風佳", "格局方正", "社區管理完整"],
    images: [],
    city: "台北市",
    district: "中山區",
    address: "南京東路二段 100 號",
    price: 32000,
    areaPing: 22,
    areaMain: 16,
    areaAncillary: 3,
    rooms: 2,
    livingRooms: 1,
    balconies: 1,
    bathrooms: 1,
    floor: 8,
    totalFloors: 14,
    areaParkingSpace: null,
    parkingSpaceInfo: null,
    parkingRent: null,
    parkingType: null,
    managementFee: 1500,
    petsAllowed: true,
    taxDeductible: true,
    rentSubsidy: true,
    canRegisterAddress: true,
    viewingMethod: "OWNER_APPOINTMENT",
    community: "中山捷運宅",
    buildingAge: 12,
    orientation: null,
    decorLevel: null,
    usageZoning: null,
    hasElevator: true,
    legalUsage: null,
    parkingIncluded: null,
    mrtLine: "松山新店線",
    mrtStation: "中山站",
    videoUrl: null,
    listingType: ListingType.RENT,
    propertyType: "APARTMENT",
    coverImage: null,
    contactName: "品牌顧問",
    contactPhone: "0912-345-678",
    ownerIdCardUrl: null,
    createdAt: new Date("2026-04-01"),
  },
  "mock-sale-1": {
    id: "mock-sale-1",
    title: "高雄美術館景觀三房",
    description: "",
    features: ["高樓層景觀宅", "近美術館園區", "優質學區", "適合自住置產"],
    images: [],
    city: "高雄市",
    district: "鼓山區",
    address: "美術東二路 80 號",
    price: 13800000,
    areaPing: 45,
    areaMain: 32,
    areaAncillary: 4.5,
    rooms: 3,
    livingRooms: 2,
    balconies: 2,
    bathrooms: 2,
    floor: 15,
    totalFloors: 24,
    areaParkingSpace: 8.5,
    parkingSpaceInfo: "B2 15",
    parkingRent: null,
    parkingType: "FLAT_RAMP",
    managementFee: 3500,
    petsAllowed: true,
    taxDeductible: null,
    rentSubsidy: null,
    canRegisterAddress: null,
    viewingMethod: "OWNER_APPOINTMENT",
    community: "美術館雙子星",
    buildingAge: 8,
    orientation: "東南",
    decorLevel: "精裝",
    usageZoning: "住宅區",
    hasElevator: true,
    legalUsage: "住家用",
    parkingIncluded: true,
    mrtLine: null,
    mrtStation: null,
    videoUrl: null,
    listingType: ListingType.SALE,
    propertyType: "APARTMENT",
    coverImage: null,
    contactName: "品牌顧問",
    contactPhone: "0912-345-678",
    ownerIdCardUrl: null,
    createdAt: new Date("2026-04-08"),
  },
};

const mockInquiries: InquiryItem[] = [
  {
    id: "inq-1",
    listingId: "mock-rent-1",
    listingTitle: "中山捷運旁兩房電梯宅",
    name: "王小明",
    phone: "0988-111-222",
    message: "想約看平日晚上時段。",
    contactTime: "平日 19:00 後",
    isHandled: false,
    handledAt: null,
    createdAt: new Date("2026-04-10T09:00:00+08:00"),
  },
];

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getListings(filters: ListingFilters): Promise<ListingCard[]> {
  if (!hasDatabaseUrl()) {
    return filterMockListings(filters);
  }

  const where: Prisma.ListingWhereInput = {
    isPublished: true,
    ...(filters.listingType ? { listingType: filters.listingType } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.keyword
      ? {
          OR: [
            { title: { contains: filters.keyword, mode: "insensitive" } },
            { city: { contains: filters.keyword, mode: "insensitive" } },
            { district: { contains: filters.keyword, mode: "insensitive" } },
            { address: { contains: filters.keyword, mode: "insensitive" } },
            { community: { contains: filters.keyword, mode: "insensitive" } },
            { description: { contains: filters.keyword, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.minPrice || filters.maxPrice
      ? {
          price: {
            ...(filters.minPrice ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
  };

  return prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}

export async function getListingById(id: string): Promise<ListingDetail | null> {
  if (!hasDatabaseUrl()) {
    return mockListingDetails[id] ?? null;
  }

  const listing = await prisma.listing.findFirst({
    where: { id, isPublished: true },
  });

  return listing;
}

export async function getAdminListingById(id: string): Promise<AdminListingDetail | null> {
  if (!hasDatabaseUrl()) {
    const detail = mockListingDetails[id];
    if (!detail) {
      return null;
    }
    return {
      ...detail,
      isPublished: true,
    };
  }

  return prisma.listing.findUnique({
    where: { id },
  });
}

export async function getAdminListings(): Promise<AdminListing[]> {
  if (!hasDatabaseUrl()) {
    return mockListings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      listingType: listing.listingType,
      city: listing.city,
      district: listing.district,
      address: listing.address,
      community: listing.community,
      price: listing.price,
      isPublished: true,
      createdAt: listing.createdAt,
    }));
  }

  return prisma.listing.findMany({
    select: {
      id: true,
      title: true,
      listingType: true,
      city: true,
      district: true,
      address: true,
      community: true,
      price: true,
      isPublished: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type AdminListingRecord = {
  id: string;
  title: string;
  listingType: ListingType;
  propertyType: string;
  city: string;
  district: string;
  address: string;
  community: string | null;
  price: number;
  areaPing: number;
  areaMain: number | null;
  areaAncillary: number | null;
  areaParkingSpace: number | null;
  rooms: number;
  livingRooms: number | null;
  balconies: number | null;
  bathrooms: number;
  floor: number | null;
  totalFloors: number | null;
  buildingAge: number | null;
  managementFee: number | null;
  parkingType: string | null;
  parkingRent: number | null;
  parkingIncluded: boolean | null;
  orientation: string | null;
  decorLevel: string | null;
  hasElevator: boolean | null;
  contactName: string;
  contactPhone: string;
  ownerIdCardUrl: string | null;
  coverImage: string | null;
  images: string[];
  videoUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAdminListingRecords(): Promise<AdminListingRecord[]> {
  if (!hasDatabaseUrl()) return [];
  const rows = await prisma.listing.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    listingType: r.listingType,
    propertyType: r.propertyType,
    city: r.city,
    district: r.district,
    address: r.address,
    community: r.community,
    price: r.price,
    areaPing: r.areaPing,
    areaMain: r.areaMain,
    areaAncillary: r.areaAncillary,
    areaParkingSpace: r.areaParkingSpace,
    rooms: r.rooms,
    livingRooms: r.livingRooms,
    balconies: r.balconies,
    bathrooms: r.bathrooms,
    floor: r.floor,
    totalFloors: r.totalFloors,
    buildingAge: r.buildingAge,
    managementFee: r.managementFee,
    parkingType: r.parkingType,
    parkingRent: r.parkingRent,
    parkingIncluded: r.parkingIncluded,
    orientation: r.orientation,
    decorLevel: r.decorLevel,
    hasElevator: r.hasElevator,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    ownerIdCardUrl: r.ownerIdCardUrl,
    coverImage: r.coverImage,
    images: r.images ?? [],
    videoUrl: r.videoUrl,
    isPublished: r.isPublished,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export type AdminStats = {
  rentPublished: number;
  salePublished: number;
  unpublished: number;
  totalListings: number;
  todayNewListings: number;
  weekNewListings: number;
  totalInquiries: number;
  unhandledInquiries: number;
  todayInquiries: number;
  weekInquiries: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  if (!hasDatabaseUrl()) {
    return {
      rentPublished: 0,
      salePublished: 0,
      unpublished: 0,
      totalListings: 0,
      todayNewListings: 0,
      weekNewListings: 0,
      totalInquiries: 0,
      unhandledInquiries: 0,
      todayInquiries: 0,
      weekInquiries: 0,
    };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    rentPublished,
    salePublished,
    unpublished,
    totalListings,
    todayNewListings,
    weekNewListings,
    totalInquiries,
    unhandledInquiries,
    todayInquiries,
    weekInquiries,
  ] = await Promise.all([
    prisma.listing.count({ where: { listingType: "RENT", isPublished: true } }),
    prisma.listing.count({ where: { listingType: "SALE", isPublished: true } }),
    prisma.listing.count({ where: { isPublished: false } }),
    prisma.listing.count(),
    prisma.listing.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.listing.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { isHandled: false } }),
    prisma.inquiry.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.inquiry.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  return {
    rentPublished,
    salePublished,
    unpublished,
    totalListings,
    todayNewListings,
    weekNewListings,
    totalInquiries,
    unhandledInquiries,
    todayInquiries,
    weekInquiries,
  };
}

export async function getInquiries(): Promise<InquiryItem[]> {
  if (!hasDatabaseUrl()) {
    return mockInquiries;
  }

  const inquiries = await prisma.inquiry.findMany({
    include: {
      listing: {
        select: {
          title: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return inquiries.map((inquiry) => ({
    id: inquiry.id,
    listingId: inquiry.listingId,
    listingTitle: inquiry.listing.title,
    name: inquiry.name,
    phone: inquiry.phone,
    message: inquiry.message,
    contactTime: inquiry.contactTime,
    isHandled: inquiry.isHandled,
    handledAt: inquiry.handledAt,
    createdAt: inquiry.createdAt,
  }));
}

function filterMockListings(filters: ListingFilters) {
  const keyword = filters.keyword?.trim().toLocaleLowerCase();
  const city = filters.city?.trim().toLocaleLowerCase();

  return mockListings
    .filter((listing) => {
      if (filters.listingType && listing.listingType !== filters.listingType) {
        return false;
      }

      if (city && !listing.city.toLocaleLowerCase().includes(city)) {
        return false;
      }

      if (keyword && !`${listing.title}${listing.district}`.toLocaleLowerCase().includes(keyword)) {
        return false;
      }

      if (filters.minPrice && listing.price < filters.minPrice) {
        return false;
      }

      if (filters.maxPrice && listing.price > filters.maxPrice) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
