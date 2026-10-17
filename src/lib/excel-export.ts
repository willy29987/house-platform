import ExcelJS from "exceljs";
import type { AdminListingRecord } from "@/lib/listings";
import {
  formatRocDate,
  getDaysUntilRelease,
  unpublishCategoryLabel,
} from "@/lib/listing-internal-meta";
import { PARKING_TYPE_LABELS as parkingTypeLabel } from "@/lib/parking-type-label";
import { propertyTypeLabel } from "@/lib/property-type-label";

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

type HyperlinkCell = { text: string; hyperlink: string };
type CellValue = string | number | HyperlinkCell;

const rentColumns: ColumnSpec[] = [
  { header: "ID", width: 26 },
  { header: "物件類型", width: 10 },
  { header: "房間號碼", width: 12 },
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
  { header: "身分證字號", width: 16 },
  { header: "圖片數", width: 8 },
  { header: "狀態", width: 8 },
  { header: "下架類型", width: 10 },
  { header: "下架時間", width: 14 },
  { header: "預計釋出", width: 14 },
  { header: "距釋出", width: 12 },
  { header: "下架備註", width: 32 },
  { header: "建立時間", width: 20 },
  { header: "最後更新", width: 20 },
  { header: "廣告連結", width: 14 },
];

const saleColumns: ColumnSpec[] = rentColumns.map((c, i) => {
  if (i === 5) return { header: "總價（萬元）", width: 14 };
  if (i === 13) return { header: "車位含總價", width: 12 };
  return c;
});

type ExportBaseUrls = { publicBaseUrl: string; adminBaseUrl: string };

function listingLinkCell(r: AdminListingRecord, bases: ExportBaseUrls): HyperlinkCell {
  const publicBase = bases.publicBaseUrl.replace(/\/$/, "");
  const adminBase = bases.adminBaseUrl.replace(/\/$/, "");
  // 上架中 → 公開廣告頁；下架物件外網不公開（會 404），改連後台物件頁
  if (r.isPublished) {
    return { text: "開啟廣告", hyperlink: `${publicBase}/listings/${r.id}` };
  }
  return { text: "後台檢視", hyperlink: `${adminBase}/admin/listings/${r.id}/edit` };
}

function formatDaysUntil(record: AdminListingRecord): string {
  if (record.isPublished) return "";
  const days = getDaysUntilRelease(record.expectedReleaseDate);
  if (days == null) return "";
  if (days < 0) return `已過 ${Math.abs(days)} 天`;
  if (days === 0) return "今日釋出";
  return `剩 ${days} 天`;
}

function unpublishInfoCells(r: AdminListingRecord): (string | number)[] {
  if (r.isPublished) return ["", "", "", "", ""];
  return [
    unpublishCategoryLabel(r.unpublishCategory),
    r.unpublishedAt ? formatRocDate(r.unpublishedAt) : "",
    r.expectedReleaseDate ? formatRocDate(r.expectedReleaseDate) : "",
    formatDaysUntil(r),
    r.unpublishNote ?? "",
  ];
}

function rentRow(r: AdminListingRecord, bases: ExportBaseUrls): CellValue[] {
  return [
    r.id,
    propertyTypeLabel(r.propertyType),
    r.roomNumber ?? "",
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
    r.isPublished ? "上架" : "下架",
    ...unpublishInfoCells(r),
    formatDate(r.createdAt),
    formatDate(r.updatedAt),
    listingLinkCell(r, bases),
  ];
}

function saleRow(r: AdminListingRecord, bases: ExportBaseUrls): CellValue[] {
  return [
    r.id,
    propertyTypeLabel(r.propertyType),
    r.roomNumber ?? "",
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
    r.isPublished ? "上架" : "下架",
    ...unpublishInfoCells(r),
    formatDate(r.createdAt),
    formatDate(r.updatedAt),
    listingLinkCell(r, bases),
  ];
}

/** 依需求排序：上架中在前（建立新→舊），下架在後（下架時間新→舊） */
function sortForExport(records: AdminListingRecord[]) {
  const published = records
    .filter((r) => r.isPublished)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const unpublished = records
    .filter((r) => !r.isPublished)
    .sort((a, b) => {
      const at = a.unpublishedAt ? new Date(a.unpublishedAt).getTime() : 0;
      const bt = b.unpublishedAt ? new Date(b.unpublishedAt).getTime() : 0;
      return bt - at;
    });
  return { published, unpublished };
}

const LINK_COLUMN_HEADER = "廣告連結";

function styleDataRow(sheet: ExcelJS.Worksheet, rowIndex: number, columns: ColumnSpec[], zebra: boolean) {
  const r = sheet.getRow(rowIndex);
  r.alignment = { vertical: "middle", wrapText: false };
  if (zebra) {
    r.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  }
  // 廣告連結欄：藍字底線（超連結樣式）
  const linkCol = columns.findIndex((c) => c.header === LINK_COLUMN_HEADER) + 1;
  if (linkCol > 0) {
    const cell = r.getCell(linkCol);
    cell.font = { color: { argb: "FF2563EB" }, underline: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }
}

function addSeparatorRow(sheet: ExcelJS.Worksheet, columns: ColumnSpec[], label: string) {
  const row = sheet.addRow([label]);
  const rowIndex = row.number;
  sheet.mergeCells(rowIndex, 1, rowIndex, columns.length);
  row.height = 26;
  const cell = sheet.getCell(rowIndex, 1);
  cell.value = label;
  cell.font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
    name: "Microsoft JhengHei",
  };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cell.fill = {
    type: "gradient",
    gradient: "angle",
    degree: 0,
    stops: [
      { position: 0, color: { argb: "FF1E3A8A" } },
      { position: 1, color: { argb: "FF3B82F6" } },
    ],
  };
  for (let c = 1; c <= columns.length; c++) {
    sheet.getCell(rowIndex, c).border = {
      top: { style: "thin", color: { argb: "FF1E3A8A" } },
      bottom: { style: "thin", color: { argb: "FF1E3A8A" } },
    };
  }
}

function setupSheet(
  sheet: ExcelJS.Worksheet,
  columns: ColumnSpec[],
  publishedRows: CellValue[][],
  unpublishedRows: CellValue[][],
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

  // 上架中
  let zebra = false;
  for (const row of publishedRows) {
    sheet.addRow(row);
    styleDataRow(sheet, sheet.rowCount, columns, zebra);
    zebra = !zebra;
  }

  // 分隔線 + 下架（依下架時間新→舊）
  if (unpublishedRows.length > 0) {
    addSeparatorRow(sheet, columns, "已下架物件　•　依下架時間由新至舊");
    zebra = false;
    for (const row of unpublishedRows) {
      sheet.addRow(row);
      styleDataRow(sheet, sheet.rowCount, columns, zebra);
      zebra = !zebra;
    }
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
}

export async function buildListingsWorkbook(
  records: AdminListingRecord[],
  bases: ExportBaseUrls,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "不動產實踐家";
  workbook.created = new Date();

  const rent = sortForExport(records.filter((r) => r.listingType === "RENT"));
  const sale = sortForExport(records.filter((r) => r.listingType === "SALE"));

  const rentSheet = workbook.addWorksheet("租賃");
  setupSheet(
    rentSheet,
    rentColumns,
    rent.published.map((r) => rentRow(r, bases)),
    rent.unpublished.map((r) => rentRow(r, bases)),
  );

  const saleSheet = workbook.addWorksheet("買賣");
  setupSheet(
    saleSheet,
    saleColumns,
    sale.published.map((r) => saleRow(r, bases)),
    sale.unpublished.map((r) => saleRow(r, bases)),
  );

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
