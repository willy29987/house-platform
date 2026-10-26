import { statusFrom591Cell } from "./lib/rental-tracking-xlsx.mjs";

const cases = [
  ["O", "同意委託"],
  ["X", "只可帶看"],
  ["o", "同意委託"],
  ["x", "只可帶看"],
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
console.log("verify-rental-591-status: ok");
