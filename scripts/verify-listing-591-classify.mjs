/**
 * 離線驗證 591 HTML 判斷邏輯（與 src/lib/listing-591-classify.ts 同步關鍵字）
 * 執行：node scripts/verify-listing-591-classify.mjs
 */

const REMOVED_MARKERS = ["物件不存在", "已下架", "找不到此物件"];
const LIVE_MARKERS = ["item-id", "rentDetail", "物件資訊"];

function classify591HttpResponse(httpStatus, body) {
  if (httpStatus === 404 || httpStatus === 410) return "removed";
  if (httpStatus === 403 || httpStatus === 429) return "unknown";
  if (httpStatus < 200 || httpStatus >= 400) return "unknown";
  const text = body.slice(0, 120_000);
  for (const m of REMOVED_MARKERS) {
    if (text.includes(m)) return "removed";
  }
  if (httpStatus === 200) {
    for (const m of LIVE_MARKERS) {
      if (text.includes(m)) return "live";
    }
  }
  return "unknown";
}

const cases = [
  [200, "<html>此物件已下架</html>", "removed"],
  [200, '<div class="item-id">1</div>物件資訊', "live"],
  [404, "", "removed"],
];

let failed = 0;
for (const [status, html, expected] of cases) {
  const got = classify591HttpResponse(status, html);
  if (got !== expected) {
    console.error("FAIL", { status, expected, got });
    failed += 1;
  }
}
if (failed > 0) {
  process.exit(1);
}
console.log("verify-listing-591-classify: ok");
