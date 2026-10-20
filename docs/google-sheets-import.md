# Google 試算表 → 內網後台遷移

將同事在 Google 試算表的歷史資料，一次性匯入 **Vercel 後台 + Supabase**，全公司共用。

## 前置條件

- 本機 `.env` 已設定 `DATABASE_URL` / `DIRECT_URL`（與 Vercel 同一 Supabase 專案）
- 已執行 `npx prisma migrate deploy`
- 匯出檔勿提交 git（見 `exports/.gitignore`）

## 快速指令

```bash
# 產生欄位範本（exports/templates/）
npm run import:spreadsheet:templates

# 屋主追蹤（先 dry-run）
npm run import:spreadsheet -- --type owner-tracking --file exports/owner-tracking.xlsx --dry-run
npm run import:spreadsheet -- --type owner-tracking --file exports/owner-tracking.xlsx

# 服務費（僅 SUPER_ADMIN 後台可見）
npm run import:spreadsheet -- --type commissions --file exports/commissions.xlsx

# 房客管理
npm run import:spreadsheet -- --type tenants --file exports/tenants.xlsx

# 物件刊登（寫入 Listing 表；預設不刊登，圖片需另於後台上傳）
npm run import:spreadsheet -- --type listings --file exports/listings.xlsx --created-by R002
```

`--replace`：以檔案覆蓋雲端 JSON（不刪除 Listing 表既有列，僅雲端三鍵）。

---

## 資料落在哪裡

| 試算表用途 | 後台路徑 | 儲存 |
|-----------|---------|------|
| 屋主追蹤 | `/admin/owner-tracking` | `AdminCloudData.owner_tracking` |
| 服務費 | `/admin/commissions` | `AdminCloudData.commission_records` |
| 房客 | `/admin/tenants` | `AdminCloudData.tenant_manager` |
| 物件刊登 | `/admin/listings` | Prisma `Listing` |

---

## 欄位對照

### 屋主追蹤 — 分頁「案件一覽」

與後台匯出 Excel 相同（見 `src/lib/owner-tracking-excel-export.ts`）。常用欄位：

| 試算表標題（建議） | 系統欄位 |
|-------------------|---------|
| 社區 | `community` |
| 縣市 / 行政區 / 路址 | `city` / `district` / `address` |
| 屋主 / 電話 | `ownerName` / `phone` |
| 負責人 | `assignee`（請填後台 **AdminUser 帳號**，如 `R002`，業務才看得到自己的案） |
| 目前狀態 / 上次備註 | 匯入時會產生一筆追蹤紀錄 |
| 物件類別 | 中文（公寓、電梯大樓…）或代碼 |

**追蹤明細**分頁（選填）：社區、完整地址、屋主、負責人、追蹤時間、填寫人、狀態、備註。

狀態允許值：`未接`、`持續聯繫`、`只可帶看`、`同意委託`、`已出租結案`、`無效／重複`（舊名稱會自動轉換）。

### 服務費

| 試算表標題 | 系統欄位 |
|-----------|---------|
| 日期 | `date`（YYYY-MM-DD） |
| 案名 | `title` |
| 類型 | `listingType`：租賃/RENT、買賣/SALE、其他 |
| 承辦 | `operator` |
| 客戶 | `client` |
| 成交金額 / 服務費 | `dealAmount` / `commission` |
| 已收款 | 是/否 |
| 備註 | `note` |

### 房客

| 試算表標題 | 系統欄位 |
|-----------|---------|
| 姓名 / 電話 / 房間 / 地址 | `name` / `phone` / `room` / `address` |
| 月租 / 繳款日 / 押金 | `monthlyRent` / `dueDay` / `deposit` |
| 起租 / 到期 | `leaseStart` / `leaseEnd` |
| 水單價 / 電單價 | `waterUnitPrice` / `electricUnitPrice` |

收租、水電月資料仍須於後台逐月輸入（試算表歷史若有多月表，需另整理或分批匯）。

### 物件刊登

| 試算表標題 | 說明 |
|-----------|------|
| 租賣 | 租賃 → RENT；買賣 → SALE |
| 月租 / 總價 | 租金或售價（元）；若總價欄為「萬元」，請在 **總價單位** 填「萬」 |
| 是否刊登 | 空白或否 → 匯入為下架，避免誤上線 |
| 承辦帳號 | 對應 `AdminUser.username` |

**限制**：試算表無法帶入封面、相簿、身分證 PDF；連結可貼在物件描述或之後於後台補傳。

---

## 若 Google 欄名不同

匯入腳本支援**多組別名**（見 `scripts/import-spreadsheet-to-cloud.mjs` 的 `pickRow`）。若仍對不上，可在試算表加一列標準標題，或用 `VLOOKUP` 對到 `exports/templates/` 範本再匯出。

---

## 驗收清單（正式站）

1. `PRODUCTION_SITE_URL=https://你的網域 npm run verify:production`
2. SUPER_ADMIN 登入 → 屋主追蹤／服務費／房客：筆數與試算表抽查 3～5 筆
3. OPERATOR（例如 R002）登入 → 屋主追蹤**僅見負責人為自己帳號**的案；側欄無服務費
4. 瀏覽器強制重新整理（Cmd+Shift+R）

---

## 與本機資料合併

若雲端已有後台操作產生的資料，預設 **merge** 不會覆蓋同去重鍵的屋主案。本機瀏覽器資料請用：

```bash
npm run push:local-admin-data
```

與試算表匯入可並用；建議順序：試算表匯入 → 再 push 本機（或反之），最後在後台抽查是否重複。
