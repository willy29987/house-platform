# 上線部署清單

把網站從本機推到公開網址（例：`urhouse.tw`），逐步做完即可。預估 **30~60 分鐘**。

---

## 0. 上線前檢查（在本機做）

### 0.1 確認資料庫是活的

```bash
npx prisma migrate status
```

看到「Database schema is up to date!」就 OK。

### 0.2 Health check（登入後台後打開）

本機跑起來，登入後台，瀏覽器開：

```
http://localhost:3000/api/admin/health
```

會回傳 JSON，每項 `ok: true` 才算 OK。其中 `Supabase Storage` 在本機可以是 `false`（沒影響）。

### 0.3 確認本機 git 狀態乾淨

```bash
git status
```

該 commit 的都 commit 好。

---

## 1. 把 Supabase Storage 設定好（5 分鐘）

上線**必做**，不做會爆炸。

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard) → 進你的 `house-platform` 專案
2. 左邊選單 → **Storage**
3. 右上 **New bucket**
   - Name：`listing-media`
   - Public bucket：✅ **勾起來**（前台要讓客戶看到圖）
   - File size limit：`100 MB`（影片留空間）
   - Allowed MIME types：留空（預設允許所有）
   - 按 **Create**
4. 左邊選單 → **Settings → API**
5. 把這兩個東西先複製到記事本先放著（等下要貼到 Vercel）：
   - **Project URL**：`https://xxxxx.supabase.co`
   - **service_role** key：`eyJhbGciOiJI...`（長字串，**這是機密，不要貼到任何公開地方**）

---

## 2. 推到 GitHub（5 分鐘）

### 2.1 先確認 `.env` 不會被推上去

```bash
git check-ignore -v .env
```

應該回傳 `.gitignore:34:.env* .env`（代表有被忽略）。

### 2.2 建 GitHub 私人 repo 並推上去

```bash
# 建 commit
git add -A
git commit -m "準備上線：加入 Supabase Storage、Excel 匯出、搜尋列"

# 到 github.com 建一個 private repo 叫 house-platform（別勾 README、.gitignore、license）
# 建完後執行（替換 你的帳號）：
git remote add origin https://github.com/你的帳號/house-platform.git
git branch -M main
git push -u origin main
```

---

## 3. 部署到 Vercel（10 分鐘）

### 3.1 匯入專案

1. 到 [vercel.com](https://vercel.com) → **Sign up** → 選「Continue with GitHub」
2. 右上角 **Add New → Project** → 找到 `house-platform` → **Import**
3. **Framework Preset**：Next.js（自動偵測）
4. **Root Directory**：`./`（預設）
5. 先別按 Deploy，展開 **Environment Variables**，把下列一個一個貼進去：

### 3.2 環境變數（按 Vercel 的介面一個一個新增）

| Name | Value |
|---|---|
| `DATABASE_URL` | `.env` 裡那個 **pooler** 那行（port 6543） |
| `DIRECT_URL` | `.env` 裡那個 **direct** 那行（port 5432） |
| `ADMIN_SESSION_TOKEN` | 隨便一串 64 字元以上的亂數；開終端機打 `openssl rand -hex 32` 取得 |
| `SUPABASE_URL` | Step 1.5 複製的 Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 1.5 複製的 service_role key |
| `SUPABASE_STORAGE_BUCKET` | `listing-media` |
| `NEXT_PUBLIC_LINE_OA_URL` | 你的 LINE 官方帳號加好友連結（可選） |
| `NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL` | 同上（可選） |
| `AI_API_KEY` | AI 團隊面板要用的金鑰（OpenAI / DeepSeek / Moonshot…）。不設就無法在 `/admin/team` 對話。 |
| `AI_BASE_URL` | 可選，預設 `https://api.openai.com/v1`。換成其他 OpenAI 相容服務即可切換供應商。 |
| `AI_MODEL` | 可選，預設 `gpt-4o-mini`。視你選的供應商改成對應 model id。 |

**全部貼完再按最底下的 Deploy**。

> ⚠️ **不要**把 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 貼到 Vercel。上線後請用你已經建好的「SUPER_ADMIN 資料庫帳號」登入，env 裡那個管理員只是本機備援。
>
> 如果你忘了資料庫管理員帳號，開本機 `npm run dev` → 登入 → 到 `/admin/settings` 看或新增。

### 3.3 第一次部署完

Vercel 會給你一個網址，長這樣：

```
https://house-platform-xxx.vercel.app
```

這就是你的網站。先開網址：

- `https://xxx.vercel.app/` — 外網首頁（客戶看的）
- `https://xxx.vercel.app/admin` — 內網後台（你看的）

兩個在同一個網域，沒登入就不能進 admin。

### 3.4（建議）內外網拆成兩個網址

若你要「外網」和「內網」分開（例如 `urhouse.tw` 與 `staff.urhouse.tw`），本專案已支援自動導向：

1. 在 Vercel 的同一個專案綁定兩個網域：
   - 外網：`urhouse.tw`
   - 內網：`staff.urhouse.tw`
2. 在 Vercel Environment Variables 新增：
   - `PUBLIC_SITE_HOST=urhouse.tw`
   - `ADMIN_SITE_HOST=staff.urhouse.tw`
3. Redeploy 後生效，行為如下：
   - 使用者在外網打 `/admin` 會自動轉到 `staff.urhouse.tw/admin`
   - 若在內網網域打到一般外網頁面，會自動轉回 `urhouse.tw`

---

## 4. 上線後驗證（10 分鐘）

### 4.1 登入後台

1. 開 `https://xxx.vercel.app/admin/login`
2. 用你的 SUPER_ADMIN 帳號登入
3. 開 `https://xxx.vercel.app/api/admin/health`
4. 確認 `ok: true`、`onVercel: true`、每項檢查都 `ok: true`

### 4.2 測試上傳

1. `/admin/listings/new` 建立一筆測試物件
2. 上傳一張封面、幾張內部照、一段影片、一張屋主身分證 PDF
3. 儲存後到 **Supabase Dashboard → Storage → listing-media**，看檔案是否出現（會有 `images/` `videos/` `docs/` 子資料夾）
4. 回前台開物件詳情頁，確認圖片都能載入、影片能播

### 4.3 測試 Excel 下載

1. `/admin/listings/records` → 右上「下載 Excel」
2. 確認 `.xlsx` 下載，用 Excel 打開兩個分頁（租賃/買賣）資料正常

---

## 5. 綁自己的網域（選配，15 分鐘）

### 5.1 買網域

推薦：
- [GoDaddy](https://www.godaddy.com)（.com 約 400 元/年）
- [Gandi](https://www.gandi.net)
- [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)（最便宜）

### 5.2 接到 Vercel

1. Vercel → 進你的專案 → **Settings → Domains**
2. 輸入 `urhouse.tw` → **Add**
3. Vercel 會告訴你要去 DNS 新增哪些紀錄（通常是一個 A 或 CNAME）
4. 到網域商的 DNS 管理頁面照著貼
5. 等 10 分鐘～幾小時（DNS 傳播時間）
6. 好了就自動有 HTTPS，訪問 `https://urhouse.tw` 就進你的網站

### 5.3 進階：內網改子網域（選配）

如果想讓 admin 看起來完全獨立（例：`staff.urhouse.tw`）：
- 同一個 Vercel 專案再加另一個 domain `staff.urhouse.tw`
- 在 `proxy.ts` 或 `middleware.ts` 根據 `host` header 做 rewrite
- 這步需要改一點程式，之後需要再跟我說

---

## 6. 上線後常用動作

### 改網站內容

1. 在本機改
2. `git commit` + `git push`
3. Vercel 自動重新部署（2~3 分鐘）
4. 網址自動更新

### 看詢問單／物件

直接開後台看即可，所有資料在 Supabase 永久保存。

### 每週備份

到 `/admin/listings/records` → 下載 Excel 存到 Google Drive / Dropbox，當本地備份。

---

## 費用總覽

| 項目 | 月費 | 年費 |
|---|---|---|
| Vercel Hobby | 免費 | 免費 |
| Supabase Free | 免費 | 免費 |
| 網域（選配）| - | ~400-800 元 |
| **合計** | **0 元** | **0-800 元** |

流量爆量才會需要升級到 Pro ($20/月)，以房仲網站的流量來說通常用不到。

---

## 出事怎麼辦？

| 症狀 | 原因 | 解法 |
|---|---|---|
| 網站 500 | Supabase 連線掛了或 env 沒設 | Vercel → Deployments → 看 log；或打開 `/api/admin/health` |
| 上傳圖片失敗 | Supabase Storage 沒設或 bucket 沒 public | 回 Step 1 重新檢查 |
| 圖片無法顯示 | `next.config.ts` 缺 supabase hostname | 已處理，確認 `next.config.ts` 有 `**.supabase.co` |
| 忘記後台密碼 | 帳號在 Supabase `AdminUser` 表 | 到 Supabase Dashboard → Table Editor 改密碼欄位 |
| 想看資料量 | 打開 `/api/admin/health` 或 Supabase Dashboard | |

遇到解不掉的錯誤，把 Vercel 的 log 截圖給我。
