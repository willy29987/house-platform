#!/usr/bin/env node
/** 產生 exports/templates/*.xlsx 標題列，方便對照 Google 試算表欄位 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "exports", "templates");

const TEMPLATES = {
  "owner-tracking.xlsx": {
    案件一覽: [
      "社區",
      "完整地址",
      "縣市",
      "行政區",
      "路址",
      "樓層",
      "總樓層",
      "屋主",
      "電話",
      "網址",
      "負責人",
      "目前狀態",
      "建立時間",
      "上次追蹤",
      "電訪",
      "上次備註",
      "物件類別",
      "租金",
      "格局",
      "使用坪數",
      "管理費",
      "其他費用",
      "車位",
      "車位編號",
      "車位價格",
      "租補",
      "報稅",
      "戶籍",
      "服務費",
      "寵物",
      "特別事項",
      "案件備註",
    ],
    追蹤明細: ["社區", "完整地址", "屋主", "負責人", "追蹤時間", "填寫人", "狀態", "備註"],
  },
  "commissions.xlsx": {
    服務費: ["日期", "案名", "類型", "承辦", "客戶", "成交金額", "服務費", "已收款", "備註"],
  },
  "tenants.xlsx": {
    房客: [
      "姓名",
      "電話",
      "房間",
      "地址",
      "月租",
      "繳款日",
      "押金",
      "起租",
      "到期",
      "水單價",
      "電單價",
      "備註",
    ],
  },
  "listings.xlsx": {
    物件: [
      "標題",
      "租賣",
      "縣市",
      "行政區",
      "路址",
      "社區",
      "月租",
      "總價",
      "總價單位",
      "坪數",
      "房",
      "廳",
      "衛",
      "樓層",
      "總樓層",
      "物件類別",
      "屋主姓名",
      "屋主電話",
      "承辦帳號",
      "是否刊登",
    ],
  },
};

async function writeTemplate(filename, sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const [name, headers] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
  }
  const outPath = path.join(OUT, filename);
  await workbook.xlsx.writeFile(outPath);
  console.log(`✓ ${outPath}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [file, sheets] of Object.entries(TEMPLATES)) {
    await writeTemplate(file, sheets);
  }
  console.log("\n可將 Google 試算表欄位對齊上述標題後，另存為 xlsx 到 exports/ 再執行 import:spreadsheet");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
