import ExcelJS from "exceljs";
import { formatAdminStaffLabel } from "@/lib/admin-staff-labels";
import { formatFollowUpWhen, formatOwnerCaseAddress, type OwnerTrackingStore } from "@/lib/owner-tracking-preview";
import { listCommunityCell, type OwnerTrackingListRow } from "@/lib/owner-tracking-list-query";
import { formatParkingTypeLabel } from "@/lib/parking-type-label";
import { PROPERTY_TYPE_OPTIONS, propertyTypeLabel, type PropertyTypeOption } from "@/lib/property-type-label";

type ColumnSpec = { header: string; width: number };

const caseColumns: ColumnSpec[] = [
  { header: "社區", width: 14 },
  { header: "完整地址", width: 32 },
  { header: "縣市", width: 10 },
  { header: "行政區", width: 10 },
  { header: "路址", width: 24 },
  { header: "樓層", width: 8 },
  { header: "總樓層", width: 8 },
  { header: "屋主", width: 12 },
  { header: "電話", width: 14 },
  { header: "網址", width: 28 },
  { header: "負責人", width: 10 },
  { header: "目前狀態", width: 12 },
  { header: "建立時間", width: 18 },
  { header: "上次追蹤", width: 18 },
  { header: "電訪", width: 8 },
  { header: "上次備註", width: 24 },
  { header: "物件類別", width: 12 },
  { header: "租金", width: 10 },
  { header: "格局", width: 14 },
  { header: "使用坪數", width: 10 },
  { header: "管理費", width: 12 },
  { header: "其他費用", width: 14 },
  { header: "車位", width: 12 },
  { header: "車位編號", width: 12 },
  { header: "車位價格", width: 12 },
  { header: "租補", width: 10 },
  { header: "報稅", width: 8 },
  { header: "戶籍", width: 8 },
  { header: "服務費", width: 10 },
  { header: "寵物", width: 8 },
  { header: "特別事項", width: 20 },
  { header: "案件備註", width: 20 },
];

const followUpColumns: ColumnSpec[] = [
  { header: "社區", width: 14 },
  { header: "完整地址", width: 28 },
  { header: "屋主", width: 12 },
  { header: "負責人", width: 10 },
  { header: "追蹤時間", width: 18 },
  { header: "填寫人", width: 10 },
  { header: "狀態", width: 12 },
  { header: "備註", width: 36 },
];

function normalizeUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  return t.startsWith("http") ? t : `https://${t}`;
}

function propertyTypeText(code: string): string {
  if ((PROPERTY_TYPE_OPTIONS as readonly string[]).includes(code)) {
    return propertyTypeLabel(code as PropertyTypeOption);
  }
  return code;
}

function setupSimpleSheet(sheet: ExcelJS.Worksheet, columns: ColumnSpec[], dataRows: ExcelJS.CellValue[][]) {
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
  });

  let zebra = false;
  for (const row of dataRows) {
    sheet.addRow(row);
    const r = sheet.getRow(sheet.rowCount);
    r.alignment = { vertical: "middle", wrapText: true };
    if (zebra) {
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    zebra = !zebra;
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (dataRows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }
}

function caseRow(
  row: OwnerTrackingListRow,
  staffLabels?: Record<string, string>,
): ExcelJS.CellValue[] {
  const c = row.case;
  const url = normalizeUrl(c.listingUrl);
  const urlCell: ExcelJS.CellValue = url
    ? { text: c.listingUrl.trim(), hyperlink: url }
    : "";
  return [
    listCommunityCell(c),
    formatOwnerCaseAddress(c),
    c.city,
    c.district,
    c.address,
    c.floor,
    c.totalFloors,
    c.ownerName,
    c.phone,
    urlCell,
    formatAdminStaffLabel(c.assignee, staffLabels),
    row.last?.status ?? "尚未追蹤",
    formatFollowUpWhen(c.createdAt),
    row.last ? formatFollowUpWhen(row.last.createdAt) : "",
    row.contactCount,
    row.last?.note?.trim() ?? "",
    propertyTypeText(c.propertyType),
    c.rent,
    c.layout,
    c.areaPing,
    c.managementFee,
    c.otherFees,
    formatParkingTypeLabel(c.parking) === "無" && c.parking.trim() ? c.parking : formatParkingTypeLabel(c.parking),
    c.parkingNumber,
    c.parkingPrice,
    c.rentSubsidy,
    c.taxFiling,
    c.householdRegistration,
    c.serviceFee,
    c.pets,
    c.specialMatters,
    c.caseNote,
  ];
}

function followUpRows(
  store: OwnerTrackingStore,
  listRows: OwnerTrackingListRow[],
  staffLabels?: Record<string, string>,
): ExcelJS.CellValue[][] {
  const caseIds = new Set(listRows.map((r) => r.case.id));
  const caseById = new Map(listRows.map((r) => [r.case.id, r.case]));
  return store.followUps
    .filter((f) => caseIds.has(f.caseId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((f) => {
      const c = caseById.get(f.caseId)!;
      return [
        listCommunityCell(c),
        formatOwnerCaseAddress(c),
        c.ownerName,
        formatAdminStaffLabel(c.assignee, staffLabels),
        formatFollowUpWhen(f.createdAt),
        formatAdminStaffLabel(f.createdBy, staffLabels),
        f.status,
        f.note,
      ];
    });
}

export async function buildOwnerTrackingWorkbook(
  store: OwnerTrackingStore,
  listRows: OwnerTrackingListRow[],
  staffLabels?: Record<string, string>,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "屋主追蹤";
  workbook.created = new Date();

  const casesSheet = workbook.addWorksheet("案件一覽");
  setupSimpleSheet(
    casesSheet,
    caseColumns,
    listRows.map((r) => caseRow(r, staffLabels)),
  );

  const followSheet = workbook.addWorksheet("追蹤明細");
  setupSimpleSheet(followSheet, followUpColumns, followUpRows(store, listRows, staffLabels));

  // 網址欄超連結樣式（案件一覽第 10 欄）
  const urlCol = 10;
  for (let i = 2; i <= casesSheet.rowCount; i++) {
    const cell = casesSheet.getCell(i, urlCol);
    if (cell.value && typeof cell.value === "object" && "hyperlink" in (cell.value as object)) {
      cell.font = { color: { argb: "FF2563EB" }, underline: true };
    }
  }

  return workbook.xlsx.writeBuffer();
}

export function downloadOwnerTrackingExcel(buffer: ArrayBuffer, filename?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const name = filename ?? `owner-tracking-${today}.xlsx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
