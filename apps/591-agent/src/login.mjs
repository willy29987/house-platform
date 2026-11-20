import { launchContext, detect591Login } from "./browser.mjs";
import { assertConfig, config } from "./config.mjs";

assertConfig();

const context = await launchContext({ headless: false });
const page = context.pages()[0] || (await context.newPage());
await page.goto("https://business.591.com.tw/", { waitUntil: "domcontentloaded" });
console.log("請在開啟的視窗登入 591 商家／會員帳號。");
console.log("登入完成後會自動偵測（最多等 10 分鐘）；也可在此按 Enter 立刻檢查。");
console.log(`設定檔目錄：${config.userDataDir}`);

let done = false;
const onEnter = () => {
  done = true;
};
process.stdin.resume();
process.stdin.once("data", onEnter);

const deadline = Date.now() + 10 * 60 * 1000;
let ok = false;
while (Date.now() < deadline && !done) {
  await page.waitForTimeout(4000);
  try {
    ok = await detect591Login(page);
  } catch (e) {
    console.warn("[login] detect error:", e?.message || e);
    ok = false;
  }
  if (ok) break;
  process.stdout.write(".");
}
process.stdin.off("data", onEnter);

if (!ok && done) {
  ok = await detect591Login(page);
}

console.log(ok ? "\n偵測：已登入" : "\n偵測：似乎尚未登入，可再試一次 npm run login");
await context.close();
process.exit(ok ? 0 : 1);
