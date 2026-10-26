import {
  isRentalTrackingSheet,
  newImportId,
  normalizeFollowUpStatus,
  normalizeOwnerTrackingStore,
  ownerCaseDedupeKey,
  parseFloorCell,
  parseTaiwanAddress,
  pickRow,
  propertyTypeFromLabel,
  PROPERTY_TYPE_LABEL,
  sheetToRecords,
  str,
} from "./spreadsheet-import-shared.mjs";

/** 試算表「591」欄：O＝同意委託，X＝只可帶看 */
export function pick591Cell(row) {
  return pickRow(row, ["591", "591廣告", "591 廣告", "591广告"]);
}

export function statusFrom591Cell(raw591) {
  const token = str(raw591)
    .toUpperCase()
    .split(/[\/／、,，\s]+/)[0];
  if (!token) return null;
  if (token === "O" || token === "○" || token === "〇" || token === "是" || token === "Y") {
    return "同意委託";
  }
  if (token === "X" || token === "×" || token === "否" || token === "N") {
    return "只可帶看";
  }
  return null;
}

/** 從案件備註「591：O」等匯入痕跡還原 591 欄 */
export function extract591FromCaseNote(caseNote) {
  const m = str(caseNote).match(/591[：:]\s*([^；\n]+)/);
  return m ? m[1].trim() : "";
}

export function mapRentalProgressToStatus(row) {
  const from591 = statusFrom591Cell(pick591Cell(row));
  if (from591) return from591;

  const progress = pickRow(row, ["進度", "Progress"]);
  const rentOut = pickRow(row, ["出租日期"]);
  const cb2 = pickRow(row, ["二次回撥", "三次回撥"]);
  const combined = `${progress} ${cb2}`;
  if (rentOut || /已出租|結案|已租/.test(combined)) return "已出租結案";
  if (/可帶看|只可帶看/.test(combined)) return "只可帶看";
  if (/未接/.test(progress)) return "未接";
  if (/未同意/.test(progress)) return "持續聯繫";
  if (/無效|重複/.test(combined)) return "無效／重複";
  if (/同意|委託/.test(combined)) return "同意委託";
  return "持續聯繫";
}

function rentalPropertyTypeAndCommunity(typeCell) {
  const t = str(typeCell);
  const knownLabels = Object.values(PROPERTY_TYPE_LABEL);
  if (knownLabels.includes(t)) {
    return { propertyType: propertyTypeFromLabel(t), community: "" };
  }
  if (Object.hasOwn(PROPERTY_TYPE_LABEL, t)) {
    return { propertyType: t, community: "" };
  }
  return { propertyType: t ? "ELEVATOR_BUILDING" : "", community: t };
}

export function parseDateCell(raw) {
  const t = str(raw);
  if (!t) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return new Date(t).toISOString();
  const m = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toISOString();
  }
  return new Date().toISOString();
}

/** Google「00-租賃追蹤表」→ OwnerTrackingStore */
export function parseRentalTrackingFromWorkbook(workbook, defaultAssignee = "R002") {
  const master = workbook.getWorksheet("總表");
  const sheets =
    master && isRentalTrackingSheet(master)
      ? [master]
      : workbook.worksheets.filter(
          (s) => isRentalTrackingSheet(s) && !["總表", "可帶看總表"].includes(s.name),
        );

  if (!sheets.length) {
    throw new Error("找不到租賃追蹤表格式（需有「物件地址」等欄位）");
  }

  const cases = [];
  const followUps = [];
  const seen = new Set();

  for (const sheet of sheets) {
    const { rows } = sheetToRecords(sheet);
    for (const row of rows) {
      const fullAddr = pickRow(row, ["物件地址", "地址"]);
      if (!fullAddr || fullAddr.includes("範例")) continue;

      const { city, district, address } = parseTaiwanAddress(fullAddr);
      const ownerName = pickRow(row, ["姓名", "屋主"]);
      const phone = pickRow(row, ["電話", "Phone"]);
      const dedupe = ownerCaseDedupeKey({ city, district, address, ownerName, phone });
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const { floor, totalFloors } = parseFloorCell(pickRow(row, ["樓層", "Floor"]));
      const { propertyType, community } = rentalPropertyTypeAndCommunity(
        pickRow(row, ["物件類別", "PropertyType"]),
      );
      const assignee = pickRow(row, ["開發業務", "負責人", "承辦"]) || defaultAssignee;
      const id = newImportId("case");
      const createdAt = parseDateCell(pickRow(row, ["開發日期", "建立時間"]));

      const metaBits = [
        pick591Cell(row) ? `591：${pick591Cell(row)}` : "",
        pickRow(row, ["公司內網"]) ? `內網：${pickRow(row, ["公司內網"])}` : "",
        pickRow(row, ["帶看"]) ? `帶看：${pickRow(row, ["帶看"])}` : "",
        sheet.name !== "總表" ? `分頁：${sheet.name}` : "",
      ].filter(Boolean);

      cases.push({
        id,
        assignee,
        createdAt,
        address,
        city,
        district,
        floor,
        totalFloors,
        propertyType,
        community,
        ownerName,
        phone,
        listingUrl: pickRow(row, ["網址", "URL"]),
        rent: pickRow(row, ["租金", "Rent"]),
        layout: pickRow(row, ["格局", "Layout"]),
        areaPing: pickRow(row, ["使用坪數", "坪數"]),
        managementFee: pickRow(row, ["管理費/月", "管理費"]),
        otherFees: "",
        parking: pickRow(row, ["車位", "Parking"]),
        parkingNumber: "",
        parkingPrice: "",
        pets: pickRow(row, ["寵物"]),
        rentSubsidy: pickRow(row, ["租補"]),
        taxFiling: "",
        householdRegistration: "",
        serviceFee: pickRow(row, ["服務費"]),
        specialMatters: pickRow(row, ["特別事項"]),
        caseNote: [pickRow(row, ["案件備註"]), metaBits.join("；")].filter(Boolean).join("\n"),
      });

      const status = mapRentalProgressToStatus(row);
      const noteParts = [
        pickRow(row, ["進度"]),
        pickRow(row, ["二次回撥"]),
        pickRow(row, ["三次回撥"]),
      ].filter(Boolean);
      followUps.push({
        id: newImportId("fu"),
        caseId: id,
        status: normalizeFollowUpStatus(status),
        note: noteParts.join(" · "),
        createdBy: assignee,
        createdAt: parseDateCell(pickRow(row, ["出租日期"]) || pickRow(row, ["開發日期"])),
      });
    }
  }

  return normalizeOwnerTrackingStore({ cases, followUps });
}
