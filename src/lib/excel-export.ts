import ExcelJS from "exceljs";
import type { AdminListingRecord } from "@/lib/listings";

const propertyTypeLabel: Record<string, string> = {
  APARTMENT: "大樓",
  HOUSE: "透天",
  STUDIO: "套房",
  OFFICE: "辦公",
  SHOP: "店面",
};

const parkingTypeLabel: Record<string, string> = {
  FLAT_RAMP: "坡道平面",
  MECHANICAL_LIFT: "機械升降",
  MECHANICAL_FLAT: "機械平面",
  RAMP_MECHANICAL: "坡道機械",
  FRONT_DOOR: "門口可停車",
  OTHER: "其他",
};

function triLabel(v: boolean | null) {
  if (v === true) return "是";
  if (v === false) return "否";
  return "";
}

function layoutText(r: AdminListingRecord) {
  const parts = [
    `${r.rooms}房`,
    r.livingRooms != null ? `${r.livingRooms}廳` : null,
    `${r.bathrooms}衛`,
    r.balconies != null ? `${r.balconies}陽台` : null,
  ].filter(Boolean);
  return parts.join("");
}

function fullAddress(r: AdminListingRecord) {
  const loc = `${r.city}${r.district}${r.address}`;
  return r.community ? `${r.community}・${loc}` : loc;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleString("zh-TW", { hour12: false });
}

type ColumnSpec = {
  header: string;
  width: number;
};

const rentColumns: ColumnSpec[] = [
  { header: "ID", width: 26 },
  { header: "物件類型", width: 10 },
  { header: "標題", width: 28 },
  { header: "社區 / 地址", width: 36 },
  { header: "月租", width: 14 },
  { header: "權狀坪", width: 10 },
  { header: "主建物坪", width: 10 },
  { header: "格局", width: 14 },
  { header: "樓層", width: 10 },
  { header: "屋齡", width: 8 },
  { header: "管理費", width: 10 },
  { header: "車位類型", width: 12 },
  { header: "車位租金", width: 10 },
  { header: "朝向", width: 8 },
  { header: "裝潢", width: 8 },
  { header: "電梯", width: 8 },
  { header: "屋主姓名", width: 12 },
  { header: "屋主電話", width: 14 },
  { header: "身分證檔案", width: 40 },
  { header: "圖片數", width: 8 },
  { header: "封面圖", width: 40 },
  { header: "影片", width: 40 },
  { header: "狀態", width: 8 },
  { header: "建立時間", width: 20 },
  { header: "最後更新", width: 20 },
];

const saleColumns: ColumnSpec[] = rentColumns.map((c, i) => {
  if (i === 4) return { header: "總價（萬元）", width: 14 };
  if (i === 12) return { header: "車位含總價", width: 12 };
  return c;
});

function rentRow(r: AdminListingRecord) {
  return [
    r.id,
    propertyTypeLabel[r.propertyType] ?? r.propertyType,
    r.title,
    fullAddress(r),
    r.price,
    r.areaPing,
    r.areaMain ?? "",
    layoutText(r),
    r.floor && r.totalFloors ? `${r.floor}/${r.totalFloors}F` : "",
    r.buildingAge != null ? `${r.buildingAge}年` : "",
    r.managementFee ?? "",
    r.parkingType ? parkingTypeLabel[r.parkingType] ?? r.parkingType : "",
    r.parkingRent ?? "",
    r.orientation ?? "",
    r.decorLevel ?? "",
    triLabel(r.hasElevator),
    r.contactName,
    r.contactPhone,
    r.ownerIdCardUrl ?? "",
    r.images.length,
    r.coverImage ?? "",
    r.videoUrl ?? "",
    r.isPublished ? "上架" : "下架",
    formatDate(r.createdAt),
    formatDate(r.updatedAt),
  ];
}

function saleRow(r: AdminListingRecord) {
  return [
    r.id,
    propertyTypeLabel[r.propertyType] ?? r.propertyType,
    r.title,
    fullAddress(r),
    Number((r.price / 10_000).toFixed(2)),
    r.areaPing,
    r.areaMain ?? "",
    layoutText(r),
    r.floor && r.totalFloors ? `${r.floor}/${r.totalFloors}F` : "",
    r.buildingAge != null ? `${r.buildingAge}年` : "",
    r.managementFee ?? "",
    r.parkingType ? parkingTypeLabel[r.parkingType] ?? r.parkingType : "",
    triLabel(r.parkingIncluded),
    r.orientation ?? "",
    r.decorLevel ?? "",
    triLabel(r.hasElevator),
    r.contactName,
    r.contactPhone,
    r.ownerIdCardUrl ?? "",
    r.images.length,
    r.coverImage ?? "",
    r.videoUrl ?? "",
    r.isPublished ? "上架" : "下架",
    formatDate(r.createdAt),
    formatDate(r.updatedAt),
  ];
}

function setupSheet(
  sheet: ExcelJS.Worksheet,
  columns: ColumnSpec[],
  rows: (string | number)[][],
) {
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B2545" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1E3A8A" } },
      left: { style: "thin", color: { argb: "FF1E3A8A" } },
      right: { style: "thin", color: { argb: "FF1E3A8A" } },
      bottom: { style: "thin", color: { argb: "FF1E3A8A" } },
    };
  });

  for (const row of rows) {
    sheet.addRow(row);
  }

  const totalRows = sheet.rowCount;
  for (let i = 2; i <= totalRows; i++) {
    const r = sheet.getRow(i);
    r.alignment = { vertical: "middle", wrapText: false };
    if (i % 2 === 0) {
      r.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
}

export async function buildListingsWorkbook(records: AdminListingRecord[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "不動產實踐家";
  workbook.created = new Date();

  const rent = records.filter((r) => r.listingType === "RENT");
  const sale = records.filter((r) => r.listingType === "SALE");

  const rentSheet = workbook.addWorksheet("租賃");
  setupSheet(rentSheet, rentColumns, rent.map(rentRow));

  const saleSheet = workbook.addWorksheet("買賣");
  setupSheet(saleSheet, saleColumns, sale.map(saleRow));

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
