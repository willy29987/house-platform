#!/usr/bin/env node
/**
 * 確認正式站（Vercel）可被公開存取，不依賴本機 dev server。
 *
 * 用法：
 *   PRODUCTION_SITE_URL=https://xxx.vercel.app npm run verify:production
 *   node scripts/verify-production.mjs https://xxx.vercel.app
 */
const baseRaw = process.env.PRODUCTION_SITE_URL?.trim() || process.argv[2]?.trim();
if (!baseRaw) {
  console.error("請設定 PRODUCTION_SITE_URL 或傳入網址，例如：");
  console.error("  PRODUCTION_SITE_URL=https://your-app.vercel.app npm run verify:production");
  process.exit(1);
}

const base = baseRaw.replace(/\/+$/, "");
if (!/^https:\/\//i.test(base)) {
  console.error("正式站請使用 https:// 開頭的網址（勿使用 localhost）。");
  process.exit(1);
}
if (/localhost|127\.0\.0\.1/i.test(base)) {
  console.error("這是本機網址，無法驗證「關機後同事仍可使用」。請改用 Vercel 網域。");
  process.exit(1);
}

const paths = [
  { name: "外網首頁", path: "/" },
  { name: "後台登入", path: "/admin/login" },
];

let failed = false;

for (const { name, path } of paths) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ok = res.status >= 200 && res.status < 400;
    console.log(`${ok ? "✓" : "✗"} ${name} ${url} → HTTP ${res.status}`);
    if (!ok) failed = true;
  } catch (e) {
    console.log(`✗ ${name} ${url} → ${e instanceof Error ? e.message : e}`);
    failed = true;
  }
}

// Health 需登入 cookie，僅提示
const healthUrl = `${base}/api/admin/health`;
try {
  const res = await fetch(healthUrl);
  if (res.status === 401) {
    console.log(`ℹ 健康檢查 ${healthUrl} 需先登入後台（401 為預期）；登入後在瀏覽器開啟應為 ok: true`);
  } else if (res.ok) {
    const json = await res.json();
    console.log(`✓ 健康檢查 ok=${json.ok} onVercel=${json.onVercel}`);
    if (!json.ok) failed = true;
  } else {
    console.log(`✗ 健康檢查 HTTP ${res.status}`);
    failed = true;
  }
} catch (e) {
  console.log(`✗ 健康檢查 → ${e instanceof Error ? e.message : e}`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log("\n正式站可從公網連線；同事無需你的電腦開機即可使用上述登入頁。");
