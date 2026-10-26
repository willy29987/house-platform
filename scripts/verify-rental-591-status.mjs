import { mapRentalProgressToStatus, statusFrom591Cell } from "./lib/rental-tracking-xlsx.mjs";

const cases = [
  ["O", "同意委託"],
  ["X", null],
  ["o", "同意委託"],
  ["x", null],
  ["O/X", "同意委託"],
  ["", null],
];
for (const [raw, expected] of cases) {
  const got = statusFrom591Cell(raw);
  if (got !== expected) {
    console.error("FAIL", { raw, got, expected });
    process.exit(1);
  }
}
if (mapRentalProgressToStatus({ 進度: "可帶看" }, "可帶看總表") !== "只可帶看") {
  console.error("FAIL view-only sheet");
  process.exit(1);
}
console.log("verify-rental-591-status: ok");
