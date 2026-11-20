import fs from "fs";
import { chromium } from "playwright";
import { config } from "./config.mjs";

export async function launchContext(opts = {}) {
  fs.mkdirSync(config.userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(config.userDataDir, {
    headless: opts.headless ?? false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return context;
}

/** 粗略判斷是否已登入 591 會員／商家後台 */
export async function detect591Login(page) {
  await page.goto("https://www.591.com.tw/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const html = await page.content();
  const url = page.url();
  // 登入頁特徵／未登入常見文案
  if (/member\/login|user\/login/i.test(url)) return false;
  if (html.includes("登入／註冊") && !html.includes("會員中心") && !html.includes("登出")) {
    // 仍可能已登入；再探商家後台
  }
  try {
    await page.goto("https://business.591.com.tw/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1200);
    const bUrl = page.url();
    const bHtml = await page.content();
    if (/login|signin/i.test(bUrl)) return false;
    if (bHtml.includes("請先登入") || bHtml.includes("帳號密碼")) return false;
    return true;
  } catch {
    return false;
  }
}
