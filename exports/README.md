# 試算表匯出目錄

從 **Google 試算表** 匯入內網後台前，請把檔案放在此目錄（**不要 commit 含個資的 xlsx**）。

## 步驟

1. Google 試算表 → **檔案 → 下載 → Microsoft Excel (.xlsx)**
2. 重新命名並放到此目錄，例如：
   - `owner-tracking.xlsx`
   - `commissions.xlsx`
   - `tenants.xlsx`
   - `listings.xlsx`
3. 確認本機 `.env` 的 `DATABASE_URL` 指向要寫入的 Supabase（通常為**正式環境**）
4. 先試跑（不寫入）：

```bash
npm run import:spreadsheet -- --type owner-tracking --file exports/owner-tracking.xlsx --dry-run
```

5. 確認筆數後寫入：

```bash
npm run import:spreadsheet -- --type owner-tracking --file exports/owner-tracking.xlsx
```

## 欄位對照

標題列請對齊 `templates/` 內範本，或與後台「匯出 Excel」相同。完整對照表見 [docs/google-sheets-import.md](../docs/google-sheets-import.md)。

## 去重規則

| 類型 | 預設 merge 去重鍵 |
|------|-------------------|
| 屋主追蹤 | 縣市 + 行政區 + 路址 + 屋主 + 電話 |
| 服務費 | 紀錄 `id`（可於試算表加 ID 欄） |
| 房客 | 房客 `id` |
| 物件刊登 | 縣市 + 行政區 + 路址 + 電話 + 標題 |

要以試算表**覆蓋**雲端現有資料時，加上 `--replace`（慎用）。

## 產生空白範本

```bash
npm run import:spreadsheet:templates
```
