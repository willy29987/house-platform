#!/usr/bin/env node
/**
 * 將 Google 試算表匯出的 xlsx 合併寫入 Supabase AdminCloudData（或 Listing 表）。
 *
 * 用法：
 *   npm run import:spreadsheet -- --type owner-tracking --file exports/owner-tracking.xlsx
 *   npm run import:spreadsheet -- --type commissions --file exports/commissions.xlsx --dry-run
 *   npm run import:spreadsheet -- --type tenants --file exports/tenants.xlsx
 *   npm run import:spreadsheet -- --type listings --file exports/listings.xlsx --created-by admin
 *
 * 選項：
 *   --replace     以檔案為準覆蓋雲端（預設為 merge 去重追加）
 *   --dry-run     只解析與統計，不寫入資料庫
 *   --format rental-tracking  Google「租賃追蹤表」（含 物件地址／開發日期 欄）
 *   --default-assignee R002   試算表未填開發業務時的負責人帳號
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  CLOUD_KEYS,
  countPayload,
  findSheet,
  loadWorkbook,
  mergeCommissionRecords,
  mergeOwnerTracking,
  mergeTenantManager,
  newImportId,
  normalizeFollowUpStatus,
  normalizeOwnerTrackingStore,
  ownerCaseDedupeKey,
  parseBoolCell,
  parseListingType,
  parseNumberCell,
  pickRow,
  propertyTypeFromLabel,
  readExistingCloud,
  isRentalTrackingSheet,
  sheetToRecords,
  str,
  upsertCloudPayload,
} from "./lib/spreadsheet-import-shared.mjs";
import { parseRentalTrackingFromWorkbook } from "./lib/rental-tracking-xlsx.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = {
    type: "",
    file: "",
    format: "",
    dryRun: false,
    replace: false,
    createdBy: "import",
    defaultAssignee: "R002",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--replace") out.replace = true;
    else if (a === "--type") out.type = argv[++i] ?? "";
    else if (a === "--file") out.file = argv[++i] ?? "";
    else if (a === "--format") out.format = argv[++i] ?? "";
    else if (a === "--default-assignee") out.defaultAssignee = argv[++i] ?? "—";
    else if (a === "--created-by") out.createdBy = argv[++i] ?? "import";
    else if (!a.startsWith("-") && !out.file) out.file = a;
  }
  return out;
}

function workbookLooksLikeRentalTracking(workbook) {
  return workbook.worksheets.some((s) => isRentalTrackingSheet(s));
}

function formatFullAddress(city, district, address, community) {
  const loc = `${str(city)}${str(district)}${str(address)}`;
  return str(community) ? `${str(community)}・${loc}` : loc;
}

function parseOwnerTrackingFromWorkbook(workbook) {
  const casesSheet = findSheet(workbook, ["案件一覽", "案件", "Cases", "Sheet1"]);
  const followSheet = findSheet(workbook, ["追蹤明細", "追蹤", "FollowUps"]);
  if (!casesSheet) throw new Error("找不到案件工作表（請用「案件一覽」或第一個分頁）");

  const { rows: caseRows } = sheetToRecords(casesSheet);
  const cases = [];
  const followUps = [];
  const addressToCaseId = new Map();

  for (const row of caseRows) {
    const id = pickRow(row, ["ID", "id", "案件ID"]) || newImportId("case");
    const city = pickRow(row, ["縣市", "City"]);
    const district = pickRow(row, ["行政區", "District"]);
    let address = pickRow(row, ["路址", "地址", "Address"]);
    const fullAddr = pickRow(row, ["完整地址", "完整路址"]);
    if (!city && !district && fullAddr) {
      address = fullAddr;
    }
    const community = pickRow(row, ["社區", "Community"]);
    const ownerName = pickRow(row, ["屋主", "姓名", "Owner"]);
    const phone = pickRow(row, ["電話", "Phone", "手機"]);
    const assignee = pickRow(row, ["負責人", "承辦", "Assignee"]) || "—";
    const listingUrl = pickRow(row, ["網址", "URL", "連結"]);
    const lastStatus = pickRow(row, ["目前狀態", "狀態", "Status"]);
    const lastNote = pickRow(row, ["上次備註", "備註", "Note"]);
    const createdAtRaw = pickRow(row, ["建立時間", "Created"]);

    const caseRec = {
      id,
      assignee,
      createdAt: createdAtRaw ? String(createdAtRaw) : new Date().toISOString(),
      address,
      city,
      district,
      floor: pickRow(row, ["樓層", "Floor"]),
      totalFloors: pickRow(row, ["總樓層", "TotalFloors"]),
      propertyType: propertyTypeFromLabel(pickRow(row, ["物件類別", "類型", "PropertyType"])),
      community,
      ownerName,
      phone,
      listingUrl,
      rent: pickRow(row, ["租金", "Rent"]),
      layout: pickRow(row, ["格局", "Layout"]),
      areaPing: pickRow(row, ["使用坪數", "坪數", "Area"]),
      managementFee: pickRow(row, ["管理費"]),
      otherFees: pickRow(row, ["其他費用"]),
      parking: pickRow(row, ["車位", "Parking"]),
      parkingNumber: pickRow(row, ["車位編號"]),
      parkingPrice: pickRow(row, ["車位價格"]),
      pets: pickRow(row, ["寵物"]),
      rentSubsidy: pickRow(row, ["租補"]),
      taxFiling: pickRow(row, ["報稅"]),
      householdRegistration: pickRow(row, ["戶籍"]),
      serviceFee: pickRow(row, ["服務費"]),
      specialMatters: pickRow(row, ["特別事項"]),
      caseNote: pickRow(row, ["案件備註", "備註說明"]),
    };
    cases.push(caseRec);

    const dedupe = ownerCaseDedupeKey(caseRec);
    addressToCaseId.set(dedupe, id);
    addressToCaseId.set(`${str(ownerName)}|${fullAddr || formatFullAddress(city, district, address, community)}`, id);

    if (lastStatus || lastNote) {
      followUps.push({
        id: newImportId("fu"),
        caseId: id,
        status: normalizeFollowUpStatus(lastStatus || "持續聯繫"),
        note: lastNote,
        createdBy: assignee,
        createdAt: pickRow(row, ["上次追蹤", "LastFollowUp"]) || caseRec.createdAt,
      });
    }
  }

  if (followSheet && followSheet !== casesSheet) {
    const { rows: fuRows } = sheetToRecords(followSheet);
    for (const row of fuRows) {
      const ownerName = pickRow(row, ["屋主", "Owner"]);
      const fullAddr = pickRow(row, ["完整地址", "地址"]);
      const assignee = pickRow(row, ["負責人", "Assignee"]);
      let caseId =
        pickRow(row, ["案件ID", "caseId"]) ||
        addressToCaseId.get(`${str(ownerName)}|${fullAddr}`) ||
        null;

      if (!caseId && ownerName) {
        for (const c of cases) {
          if (c.ownerName === ownerName && (fullAddr.includes(c.address) || fullAddr.includes(c.city))) {
            caseId = c.id;
            break;
          }
        }
      }
      if (!caseId) continue;

      followUps.push({
        id: pickRow(row, ["ID", "id"]) || newImportId("fu"),
        caseId,
        status: normalizeFollowUpStatus(pickRow(row, ["狀態", "Status"])),
        note: pickRow(row, ["備註", "Note"]),
        createdBy: pickRow(row, ["填寫人", "CreatedBy"]) || assignee,
        createdAt: pickRow(row, ["追蹤時間", "時間", "CreatedAt"]) || new Date().toISOString(),
      });
    }
  }

  return normalizeOwnerTrackingStore({ cases, followUps });
}

function parseCommissionsFromWorkbook(workbook) {
  const sheet = findSheet(workbook, ["服務費", "成交", "Commissions", "Sheet1"]);
  if (!sheet) throw new Error("找不到工作表");
  const { rows } = sheetToRecords(sheet);
  return rows.map((row) => {
    const listingType = parseListingType(pickRow(row, ["類型", "租賣", "ListingType", "物件類型"]));
    const dealAmount = parseNumberCell(pickRow(row, ["成交金額", "成交額", "DealAmount", "月租", "總價"]));
    const commission = parseNumberCell(pickRow(row, ["服務費", "佣金", "Commission"]));
    const dateRaw = pickRow(row, ["日期", "成交日期", "Date"]);
    return {
      id: pickRow(row, ["ID", "id"]) || newImportId("c"),
      date: dateRaw ? String(dateRaw).slice(0, 10) : new Date().toISOString().slice(0, 10),
      title: pickRow(row, ["案名", "物件", "Title", "標題"]),
      listingType,
      operator: pickRow(row, ["承辦", "業務", "Operator", "負責人"]),
      client: pickRow(row, ["客戶", "屋主", "Client"]),
      dealAmount,
      commission,
      received: parseBoolCell(pickRow(row, ["已收款", "Received", "收款"])),
      note: pickRow(row, ["備註", "Note"]),
      createdAt: new Date().toISOString(),
      listingId: pickRow(row, ["ListingId", "刊登ID"]) || undefined,
    };
  });
}

function parseTenantsFromWorkbook(workbook) {
  const sheet = findSheet(workbook, ["房客", "Tenants", "Sheet1"]);
  if (!sheet) throw new Error("找不到工作表");
  const { rows } = sheetToRecords(sheet);
  const tenants = rows.map((row) => ({
    id: pickRow(row, ["ID", "id"]) || newImportId("t"),
    name: pickRow(row, ["姓名", "房客", "Name"]),
    phone: pickRow(row, ["電話", "Phone"]),
    room: pickRow(row, ["房間", "Room", "房間號碼"]),
    address: pickRow(row, ["地址", "Address"]),
    monthlyRent: parseNumberCell(pickRow(row, ["月租", "MonthlyRent"])),
    dueDay: Math.min(28, Math.max(1, parseNumberCell(pickRow(row, ["繳款日", "DueDay"])) || 5)),
    deposit: parseNumberCell(pickRow(row, ["押金", "Deposit"])),
    leaseStart: pickRow(row, ["起租", "LeaseStart", "起租日"]),
    leaseEnd: pickRow(row, ["到期", "LeaseEnd", "到期日"]),
    waterUnitPrice: parseNumberCell(pickRow(row, ["水單價", "WaterUnitPrice"])),
    electricUnitPrice: parseNumberCell(pickRow(row, ["電單價", "ElectricUnitPrice"])),
    note: pickRow(row, ["備註", "Note"]),
    createdAt: new Date().toISOString(),
  }));
  return { tenants, rent: {}, utility: {} };
}

const LISTING_TYPE_ENUM = { RENT: "RENT", SALE: "SALE" };
const PROPERTY_ENUM = new Set([
  "APARTMENT",
  "ELEVATOR_BUILDING",
  "HOUSE",
  "STUDIO",
  "SUITE",
  "OFFICE",
  "SHOP",
]);

function parseListingsFromWorkbook(workbook) {
  const sheet = findSheet(workbook, ["物件", "Listings", "刊登", "Sheet1"]);
  if (!sheet) throw new Error("找不到工作表");
  const { rows } = sheetToRecords(sheet);
  return rows.map((row) => {
    const listingTypeRaw = parseListingType(pickRow(row, ["租賣", "類型", "ListingType", "物件類型"]));
    const listingType = listingTypeRaw === "SALE" ? LISTING_TYPE_ENUM.SALE : LISTING_TYPE_ENUM.RENT;
    let propertyType = propertyTypeFromLabel(pickRow(row, ["物件類別", "PropertyType"]));
    if (!PROPERTY_ENUM.has(propertyType)) propertyType = "APARTMENT";

    const priceNote = pickRow(row, ["總價單位", "PriceUnit"]);
    let price = parseNumberCell(pickRow(row, ["月租", "總價", "Price", "價格"]));
    if (listingType === "SALE" && (priceNote.includes("萬") || price < 10000)) {
      price = Math.round(price * 10000);
    }

    const rooms = parseNumberCell(pickRow(row, ["房", "Rooms"])) || 1;
    const livingRooms = parseNumberCell(pickRow(row, ["廳", "LivingRooms"])) || 1;
    const bathrooms = parseNumberCell(pickRow(row, ["衛", "Bathrooms"])) || 1;
    const community = pickRow(row, ["社區", "Community"]);
    const city = pickRow(row, ["縣市", "City"]);
    const district = pickRow(row, ["行政區", "District"]);
    const address = pickRow(row, ["路址", "地址", "Address"]);
    const title =
      pickRow(row, ["標題", "Title"]) ||
      formatFullAddress(city, district, address, community) ||
      "匯入物件";

    return {
      title,
      description: `__listing_meta__:${JSON.stringify({
        createdByUsername: pickRow(row, ["承辦帳號", "CreatedBy", "承辦"]),
        importSource: "google-spreadsheet",
      })}\n`,
      city,
      district,
      address,
      community: community || null,
      price: Math.round(price),
      areaPing: parseNumberCell(pickRow(row, ["坪數", "AreaPing"])) || 0,
      rooms: Math.round(rooms),
      livingRooms: Math.round(livingRooms),
      bathrooms: Math.round(bathrooms),
      floor: parseNumberCell(pickRow(row, ["樓層", "Floor"])) || null,
      totalFloors: parseNumberCell(pickRow(row, ["總樓層", "TotalFloors"])) || null,
      listingType,
      propertyType,
      contactName: pickRow(row, ["屋主姓名", "ContactName", "屋主"]) || "—",
      contactPhone: pickRow(row, ["屋主電話", "ContactPhone", "電話"]) || "—",
      isPublished: (() => {
        const pub = pickRow(row, ["刊登", "Published", "是否刊登"]);
        if (!pub) return false;
        return ["是", "Y", "1", "刊登中", "TRUE"].includes(str(pub).toUpperCase()) || pub === "是";
      })(),
      features: [],
      images: [],
    };
  });
}

async function importListings(prisma, records, createdByUsername, dryRun) {
  const user = await prisma.adminUser.findUnique({ where: { username: createdByUsername } });
  if (!user) {
    console.warn(`⚠ 找不到 AdminUser「${createdByUsername}」，meta 仍會寫入承辦欄位`);
  }

  let created = 0;
  let skipped = 0;
  for (const rec of records) {
    const meta = JSON.parse(rec.description.slice("__listing_meta__:".length).split("\n")[0]);
    meta.createdByUsername = meta.createdByUsername || createdByUsername;

    const existing = await prisma.listing.findFirst({
      where: {
        city: rec.city,
        district: rec.district,
        address: rec.address,
        contactPhone: rec.contactPhone,
        title: rec.title,
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.listing.create({
        data: {
          ...rec,
          description: `__listing_meta__:${JSON.stringify(meta)}\n`,
        },
      });
    }
    created += 1;
  }
  return { created, skipped };
}

async function main() {
  process.chdir(ROOT);
  const args = parseArgs(process.argv);

  if (!args.type || !args.file) {
    console.error("請指定 --type 與 --file");
    console.error("  npm run import:spreadsheet -- --type owner-tracking --file exports/owner-tracking.xlsx");
    process.exit(1);
  }

  const filePath = path.isAbsolute(args.file) ? args.file : path.join(ROOT, args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`找不到檔案：${filePath}`);
    console.error("請先從 Google 試算表下載 xlsx 到 exports/（見 exports/README.md）");
    process.exit(1);
  }

  const workbook = await loadWorkbook(filePath);
  const mode = args.replace ? "replace" : "merge";
  const prisma = new PrismaClient();

  try {
    if (args.type === "owner-tracking") {
      const useRental =
        args.format === "rental-tracking" ||
        (args.format !== "standard" && workbookLooksLikeRentalTracking(workbook));
      const incoming = useRental
        ? parseRentalTrackingFromWorkbook(workbook, args.defaultAssignee)
        : parseOwnerTrackingFromWorkbook(workbook);
      if (useRental) {
        console.log(`（格式：租賃追蹤表${args.defaultAssignee !== "—" ? `，預設負責人 ${args.defaultAssignee}` : ""}）`);
      }
      const existing = await readExistingCloud(prisma);
      const merged = mergeOwnerTracking(existing[CLOUD_KEYS.ownerTracking], incoming, { mode });
      console.log(
        `屋主追蹤：檔案 ${incoming.cases.length} 案 / ${incoming.followUps.length} 追蹤 → 合併後 ${merged.cases.length} 案 / ${merged.followUps.length} 追蹤（${mode}）`,
      );
      if (!args.dryRun) {
        await upsertCloudPayload(prisma, CLOUD_KEYS.ownerTracking, merged);
        console.log(`✓ 已寫入 Supabase ${CLOUD_KEYS.ownerTracking}（${countPayload(CLOUD_KEYS.ownerTracking, merged)}）`);
      } else {
        console.log("（dry-run，未寫入）");
      }
    } else if (args.type === "commissions") {
      const incoming = parseCommissionsFromWorkbook(workbook);
      const existing = await readExistingCloud(prisma);
      const merged = mergeCommissionRecords(existing[CLOUD_KEYS.commissionRecords], incoming, { mode });
      console.log(`服務費：檔案 ${incoming.length} 筆 → 合併後 ${merged.length} 筆（${mode}）`);
      if (!args.dryRun) {
        await upsertCloudPayload(prisma, CLOUD_KEYS.commissionRecords, merged);
        console.log(`✓ 已寫入 Supabase ${CLOUD_KEYS.commissionRecords}（${countPayload(CLOUD_KEYS.commissionRecords, merged)}）`);
      } else {
        console.log("（dry-run，未寫入）");
      }
    } else if (args.type === "tenants") {
      const incoming = parseTenantsFromWorkbook(workbook);
      const existing = await readExistingCloud(prisma);
      const merged = mergeTenantManager(existing[CLOUD_KEYS.tenantManager], incoming, { mode });
      console.log(`房客：檔案 ${incoming.tenants.length} 人 → 合併後 ${merged.tenants.length} 人（${mode}）`);
      if (!args.dryRun) {
        await upsertCloudPayload(prisma, CLOUD_KEYS.tenantManager, merged);
        console.log(`✓ 已寫入 Supabase ${CLOUD_KEYS.tenantManager}（${countPayload(CLOUD_KEYS.tenantManager, merged)}）`);
      } else {
        console.log("（dry-run，未寫入）");
      }
    } else if (args.type === "listings") {
      const records = parseListingsFromWorkbook(workbook);
      const { created, skipped } = await importListings(prisma, records, args.createdBy, args.dryRun);
      console.log(`物件刊登：解析 ${records.length} 筆 → 新增 ${created}、略過重複 ${skipped}（${args.dryRun ? "dry-run" : "已寫入 Listing 表"}）`);
    } else {
      console.error(`不支援的 --type：${args.type}`);
      process.exit(1);
    }

    if (!args.dryRun) {
      console.log("\n驗收：登入 Vercel 後台 → 對應模組重新整理；業務帳號確認屋主追蹤僅見負責人案件。");
      console.log("詳見 docs/google-sheets-import.md");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
