import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMG = {
  rent1Cover:
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
  rent1Others: [
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80",
  ],
  sale1Cover:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
  sale1Others: [
    "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
  ],
  rent2Cover:
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
  rent2Others: [
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=80",
  ],
};

async function main() {
  console.log("🌱 開始建立 3 筆 Demo 測試廣告...");

  const demos = [
    {
      title: "MRT 信義安和｜全新裝潢三房雙衛電梯宅",
      description: "",
      features: [
        "鄰近信義安和捷運站 3 分鐘",
        "採光通風俱佳",
        "全屋重新整理、家電齊全",
        "頂級社區 24 小時管理",
        "近信義商圈、百貨林立",
        "可選配車位",
      ],
      city: "台北市",
      district: "大安區",
      address: "和平東路三段 88 號",
      community: "和平 A25 景觀宅",
      listingType: "RENT" as const,
      propertyType: "APARTMENT" as const,
      price: 58000,
      areaPing: 32.5,
      areaMain: 24.3,
      areaAncillary: 4.2,
      areaParkingSpace: 4,
      parkingSpaceInfo: "B2 15",
      parkingRent: 5000,
      parkingType: "FLAT_RAMP",
      managementFee: 3500,
      petsAllowed: false,
      taxDeductible: true,
      rentSubsidy: true,
      canRegisterAddress: true,
      viewingMethod: "OWNER_APPOINTMENT",
      buildingAge: 8,
      hasElevator: true,
      parkingIncluded: null,
      mrtLine: "台北捷運 淡水信義線",
      mrtStation: "信義安和站",
      rooms: 3,
      livingRooms: 2,
      balconies: 2,
      bathrooms: 2,
      floor: 12,
      totalFloors: 18,
      coverImage: IMG.rent1Cover,
      images: [IMG.rent1Cover, ...IMG.rent1Others],
      contactName: "王顧問",
      contactPhone: "0911-222-333",
      isPublished: true,
    },
    {
      title: "內湖科技園區｜四房豪宅景觀樓中樓",
      description: "",
      features: [
        "近內湖科學園區、通勤方便",
        "挑高樓中樓格局",
        "高樓層市景夜景",
        "附雙車位",
        "學區優質（麗山國中）",
        "社區健身房 / 泳池",
      ],
      city: "台北市",
      district: "內湖區",
      address: "民權東路六段 168 號",
      community: "文心 AIT 樓中樓",
      listingType: "SALE" as const,
      propertyType: "APARTMENT" as const,
      price: 48_800_000,
      areaPing: 68.2,
      areaMain: 52.6,
      areaAncillary: 8,
      areaParkingSpace: 7.6,
      parkingSpaceInfo: "B3 7, B3 8",
      parkingRent: null,
      parkingType: "FLAT_RAMP",
      managementFee: 6200,
      petsAllowed: null,
      taxDeductible: null,
      rentSubsidy: null,
      canRegisterAddress: null,
      viewingMethod: null,
      buildingAge: 12,
      hasElevator: true,
      parkingIncluded: true,
      orientation: "東南",
      decorLevel: "豪華裝潢",
      usageZoning: "住宅區",
      legalUsage: "住家用",
      mrtLine: "台北捷運 文湖線",
      mrtStation: "內湖站",
      rooms: 4,
      livingRooms: 2,
      balconies: 2,
      bathrooms: 3,
      floor: 15,
      totalFloors: 22,
      coverImage: IMG.sale1Cover,
      images: [IMG.sale1Cover, ...IMG.sale1Others],
      contactName: "林顧問",
      contactPhone: "0933-555-777",
      isPublished: true,
    },
    {
      title: "板橋江翠｜明亮兩房電梯宅．附車位",
      description: "",
      features: [
        "鄰近新埔民生捷運站",
        "生活機能成熟（江翠商圈）",
        "採光明亮、格局方正",
        "車位機械平面",
        "可寵物友善（小型犬貓）",
        "一開即住、免再整修",
      ],
      city: "新北市",
      district: "板橋區",
      address: "文化路二段 256 號",
      community: "江翠湛",
      listingType: "RENT" as const,
      propertyType: "APARTMENT" as const,
      price: 32000,
      areaPing: 22.8,
      areaMain: 17.2,
      areaAncillary: 2.5,
      areaParkingSpace: 3.1,
      parkingSpaceInfo: "B1 28",
      parkingRent: 2500,
      parkingType: "MECHANICAL_FLAT",
      managementFee: 1800,
      petsAllowed: true,
      taxDeductible: true,
      rentSubsidy: false,
      canRegisterAddress: true,
      viewingMethod: "KEY",
      buildingAge: 15,
      hasElevator: true,
      parkingIncluded: null,
      mrtLine: "台北捷運 板南線",
      mrtStation: "新埔民生站",
      rooms: 2,
      livingRooms: 1,
      balconies: 1,
      bathrooms: 1,
      floor: 8,
      totalFloors: 14,
      coverImage: IMG.rent2Cover,
      images: [IMG.rent2Cover, ...IMG.rent2Others],
      contactName: "陳顧問",
      contactPhone: "0922-888-111",
      isPublished: true,
    },
  ];

  for (const d of demos) {
    const created = await prisma.listing.create({ data: d });
    console.log(`✅  ${created.listingType === "RENT" ? "租賃" : "買賣"}：${created.title}  → /listings/${created.id}`);
  }

  console.log("🎉 完成！");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
