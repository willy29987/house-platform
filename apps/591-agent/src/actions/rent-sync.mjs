/**
 * 591 租賃操作（選擇器集中於此；591 改版時優先改這一檔）。
 * 無法保證對所有帳號／版型 100% 成功：失敗會回報 needs_login / failed。
 */

function rentManageUrl(source591Id) {
  // 商家後台物件管理常見入口；實際路徑依帳號可能不同，失敗時改走搜尋
  return `https://business.591.com.tw/v2/index.php/house/rentSale/index`;
}

function publicRentUrl(id) {
  return `https://rent.591.com.tw/rent-detail-${id}.html`;
}

async function ensureLoggedIn(page) {
  const { detect591Login } = await import("../browser.mjs");
  const ok = await detect591Login(page);
  if (!ok) {
    const err = new Error("591 未登入或登入已過期，請在本機執行 npm run login");
    err.code = "needs_login";
    throw err;
  }
}

async function openListing(page, snapshot) {
  const id = (snapshot.source591Id || "").trim();
  if (id) {
    // 先確認前台是否還在
    const res = await page.goto(publicRentUrl(id), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(800);
    const status = res?.status?.() ?? 0;
    if (status === 404 || (await page.content()).includes("物件不存在")) {
      return { found: false, id };
    }
    return { found: true, id, publicUrl: publicRentUrl(id) };
  }
  return { found: false, id: null };
}

/**
 * 嘗試在商家後台用關鍵字找到物件並點下架／上架。
 * 若 UI 對不上，回傳可重試錯誤，不假裝成功。
 */
async function togglePublishInBusiness(page, snapshot, wantPublished) {
  await page.goto(rentManageUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  const keyword =
    (snapshot.source591Id || "").trim() ||
    `${snapshot.district}${snapshot.address}`.slice(0, 20) ||
    snapshot.title.slice(0, 20);

  // 搜尋框（多組備援）
  const searchSelectors = [
    'input[placeholder*="搜尋"]',
    'input[placeholder*="關鍵"]',
    'input[type="search"]',
    "input.search-input",
  ];
  let filled = false;
  for (const sel of searchSelectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.fill(keyword);
      filled = true;
      break;
    }
  }
  if (filled) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
  }

  const row = snapshot.source591Id
    ? page.locator(`text=${snapshot.source591Id}`).first()
    : page.locator("tr, .list-item, .house-item").filter({ hasText: keyword }).first();

  if (!(await row.count())) {
    throw new Error(
      `商家後台找不到物件（關鍵字：${keyword}）。請確認已登入正確帳號，或手動對好 source591Id。`,
    );
  }

  // 在同一列找上／下架按鈕
  const container = row.locator("xpath=ancestor-or-self::tr[1] | ancestor-or-self::*[contains(@class,'item')][1]");
  const scope = (await container.count()) ? container : row;
  const btnText = wantPublished ? /上架|重新上架|刊登/ : /下架|關閉|停刊/;
  const btn = scope.getByRole("button", { name: btnText }).or(scope.locator("a, button", { hasText: btnText })).first();
  if (await btn.count()) {
    await btn.click({ timeout: 10000 });
    await page.waitForTimeout(1200);
    // 確認對話框
    const confirm = page.getByRole("button", { name: /確定|確認|OK/i }).first();
    if (await confirm.count()) {
      await confirm.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    return;
  }

  throw new Error(
    `找到物件但找不到${wantPublished ? "上架" : "下架"}按鈕（591 版型可能已變，需更新選擇器）。`,
  );
}

async function tryFillFields(page, snapshot) {
  // 盡力開啟編輯頁：由商家列表點「編輯」；失敗則報錯讓雲端標記 failed
  await page.goto(rentManageUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  const id = (snapshot.source591Id || "").trim();
  if (id) {
    const hit = page.locator(`text=${id}`).first();
    if (await hit.count()) {
      const edit = hit
        .locator("xpath=ancestor-or-self::tr[1]//a[contains(.,'編輯')] | ancestor-or-self::*[contains(@class,'item')][1]//a[contains(.,'編輯')]")
        .first();
      if (await edit.count()) {
        await edit.click();
        await page.waitForTimeout(1500);
      }
    }
  }

  const setIf = async (selectors, value) => {
    if (value == null || String(value).trim() === "") return false;
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if (await el.count()) {
        await el.fill(String(value));
        return true;
      }
    }
    return false;
  };

  let filled = 0;
  if (await setIf(['input[name*="price"]', 'input[placeholder*="租金"]'], snapshot.price)) filled++;
  if (await setIf(['input[name*="title"]', 'input[placeholder*="標題"]'], snapshot.title)) filled++;
  if (
    await setIf(
      ['textarea[name*="remark"]', 'textarea[name*="desc"]', "textarea"],
      [snapshot.specialMatters, ...(snapshot.features || [])].filter(Boolean).join("\n"),
    )
  ) {
    filled++;
  }
  if (await setIf(['input[name*="address"]', 'input[placeholder*="地址"]'], snapshot.address)) filled++;

  const save = page.getByRole("button", { name: /儲存|保存|送出|完成/ }).first();
  if (await save.count()) {
    await save.click();
    await page.waitForTimeout(1500);
  }

  if (filled === 0) {
    throw new Error("未能寫入任何欄位（可能未開到編輯頁或版型不符）。");
  }
  return { filled };
}

async function tryUploadPhotos(page, snapshot) {
  const images = [...(snapshot.images || [])];
  if (snapshot.coverImage && !images.includes(snapshot.coverImage)) {
    images.unshift(snapshot.coverImage);
  }
  if (!images.length) return { uploaded: 0, skipped: true };

  // 照片上傳高度依賴 UI；此處下載到暫存再 setInputFiles
  const input = page.locator('input[type="file"]').first();
  if (!(await input.count())) {
    throw new Error("找不到照片上傳控件；欄位可能已同步，照片需稍後重試。");
  }

  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hp591-"));
  const files = [];
  for (let i = 0; i < Math.min(images.length, 12); i++) {
    const url = images[i];
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = url.includes(".png") ? "png" : "jpg";
      const fp = path.join(dir, `p${i}.${ext}`);
      fs.writeFileSync(fp, buf);
      files.push(fp);
    } catch {
      // skip one
    }
  }
  if (!files.length) throw new Error("照片下載失敗，無法上傳。");
  await input.setInputFiles(files);
  await page.waitForTimeout(2500);
  return { uploaded: files.length };
}

async function refreshStatus(page, snapshot) {
  const id = (snapshot.source591Id || "").trim();
  if (!id) return { result591Status: "unknown" };
  const res = await page.goto(publicRentUrl(id), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  const status = res?.status?.() ?? 0;
  const html = await page.content();
  if (status === 404 || html.includes("物件不存在") || html.includes("已關閉")) {
    return { result591Status: "unpublished", result591Id: id, result591Url: publicRentUrl(id) };
  }
  if (html.includes("出租") || html.includes("元/月") || html.includes("格局")) {
    return { result591Status: "published", result591Id: id, result591Url: publicRentUrl(id) };
  }
  return { result591Status: "unknown", result591Id: id, result591Url: publicRentUrl(id) };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** 從商家後台／詳情文字解析廣告到期日 → YYYY-MM-DD */
export function parseExpiryFromText(text) {
  if (!text) return null;
  const west = text.match(
    /(?:廣告)?到期[日時]?[：:\s]*(\d{4})\s*[年\/\-.]\s*(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})/,
  );
  if (west) {
    return `${west[1]}-${pad2(west[2])}-${pad2(west[3])}`;
  }
  const roc = text.match(
    /(?:廣告)?到期[日時]?[：:\s]*(\d{2,3})\s*[年\/\-.]\s*(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})/,
  );
  if (roc) {
    const y = Number(roc[1]) + 1911;
    if (y >= 2000 && y <= 2100) {
      return `${y}-${pad2(roc[2])}-${pad2(roc[3])}`;
    }
  }
  const remain = text.match(/剩餘\s*(\d+)\s*天/);
  if (remain) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + Number(remain[1]));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return null;
}

async function refreshExpiry(page, snapshot) {
  const id = (snapshot.source591Id || "").trim();
  if (!id) throw new Error("無 591 案號，無法查到期日");

  await page.goto(rentManageUrl(id), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  const searchSelectors = [
    'input[placeholder*="搜尋"]',
    'input[placeholder*="關鍵"]',
    'input[type="search"]',
    "input.search-input",
  ];
  for (const sel of searchSelectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.fill(id);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      break;
    }
  }

  let text = await page.locator("body").innerText().catch(() => "");
  let expiresAt = parseExpiryFromText(text);

  // 列上找不到 → 試點進編輯／詳情
  if (!expiresAt) {
    const hit = page.locator(`text=${id}`).first();
    if (await hit.count()) {
      const link = hit
        .locator(
          "xpath=ancestor-or-self::tr[1]//a[contains(.,'編輯') or contains(.,'管理') or contains(.,'詳情')] | ancestor-or-self::*[contains(@class,'item')][1]//a[contains(.,'編輯') or contains(.,'管理') or contains(.,'詳情')]",
        )
        .first();
      if (await link.count()) {
        await link.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1500);
        text = await page.locator("body").innerText().catch(() => "");
        expiresAt = parseExpiryFromText(text);
      }
    }
  }

  if (!expiresAt) {
    throw new Error(
      `找不到 591 廣告到期日（案號 ${id}）。請確認商家後台有「到期日／剩餘天數」欄位，或 591 版型需更新選擇器。`,
    );
  }

  return {
    result591Id: id,
    resultExpiresAt: expiresAt,
    logLine: `expires:${expiresAt}`,
  };
}

export async function runJob(page, job) {
  await ensureLoggedIn(page);
  const snapshot = job.snapshot;
  const type = job.type;

  if (type === "refresh_status") {
    return await refreshStatus(page, snapshot);
  }

  if (type === "refresh_expiry") {
    return await refreshExpiry(page, snapshot);
  }

  if (type === "publish" || type === "unpublish") {
    const want = type === "publish";
    const opened = await openListing(page, snapshot);
    if (!opened.found && !snapshot.source591Id) {
      throw new Error("尚無 source591Id，請先完成 update_fields（新建刊登）再上架。");
    }
    await togglePublishInBusiness(page, snapshot, want);
    return {
      result591Id: snapshot.source591Id,
      result591Url: snapshot.source591Url || (snapshot.source591Id ? publicRentUrl(snapshot.source591Id) : null),
      result591Status: want ? "published" : "unpublished",
    };
  }

  if (type === "update_fields") {
    if (!snapshot.source591Id) {
      // 新建流程：目前回報明確錯誤，避免假成功；後續可擴充完整新建精靈
      throw new Error(
        "此物件尚無 591 案號。請先在 591 手動建案並把網址填回本站，或待 Agent 新建流程完成後再同步。",
      );
    }
    const r = await tryFillFields(page, snapshot);
    return {
      result591Id: snapshot.source591Id,
      result591Url: snapshot.source591Url || publicRentUrl(snapshot.source591Id),
      result591Status: snapshot.isPublished ? "published" : "unpublished",
      logLine: `fields_filled:${r.filled}`,
    };
  }

  if (type === "update_photos") {
    if (!snapshot.source591Id) {
      throw new Error("尚無 source591Id，略過照片同步。");
    }
    // 先嘗試開編輯頁再上傳
    await tryFillFields(page, snapshot).catch(() => {});
    const r = await tryUploadPhotos(page, snapshot);
    return {
      result591Id: snapshot.source591Id,
      result591Url: snapshot.source591Url || publicRentUrl(snapshot.source591Id),
      result591Status: snapshot.isPublished ? "published" : "unpublished",
      logLine: `photos_uploaded:${r.uploaded}`,
    };
  }

  throw new Error(`未知任務類型：${type}`);
}
