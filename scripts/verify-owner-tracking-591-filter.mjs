/**
 * 離線驗證「可上591」篩選含備註 591:O（與 owner-tracking-case-status.ts 對齊）
 * node scripts/verify-owner-tracking-591-filter.mjs
 */

function extract591FromCaseNote(caseNote) {
  const m = String(caseNote ?? "").match(/591[：:]\s*([^；\n]+)/);
  return m ? m[1].trim() : "";
}

function is591EntrustCaseNote(caseNote) {
  const token = extract591FromCaseNote(caseNote).toUpperCase().split(/[\/／、,，\s]+/)[0];
  if (!token) return false;
  return token === "O" || token === "○" || token === "〇" || token === "是" || token === "Y";
}

function normalizeFollowUpStatus(status) {
  const legacy = {
    同意委託: "可上591",
    已出租結案: "屋主已出租",
    "無效／重複": "屋主已出租",
  };
  const t = String(status ?? "").trim();
  if (legacy[t]) return legacy[t];
  if (["持續聯繫", "只可帶看", "可上591", "屋主已出租"].includes(t)) return t;
  return "持續聯繫";
}

function resolveEffective(lastStatus, caseNote) {
  if (lastStatus) return normalizeFollowUpStatus(lastStatus);
  if (is591EntrustCaseNote(caseNote)) return "可上591";
  return "持續聯繫";
}

function matches可上591(lastStatus, caseNote) {
  const effective = resolveEffective(lastStatus, caseNote);
  if (effective === "可上591") return true;
  if (effective !== "屋主已出租" && is591EntrustCaseNote(caseNote)) return true;
  return false;
}

const checks = [
  [matches可上591("可上591", ""), true],
  [matches可上591("持續聯繫", "591：O"), true],
  [matches可上591("只可帶看", "591:O"), true],
  [matches可上591("屋主已出租", "591：O"), false],
  [matches可上591("持續聯繫", "591：X"), false],
  [matches可上591(null, "591：O"), true],
  [matches可上591("持續聯繫", ""), false],
];

let failed = 0;
for (const [got, expected] of checks) {
  if (got !== expected) {
    console.error("FAIL", { got, expected });
    failed += 1;
  }
}
if (failed > 0) process.exit(1);
console.log("verify-owner-tracking-591-filter: ok");
