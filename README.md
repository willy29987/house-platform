# House Platform MVP

這是一個類似 591 的網站 MVP，先支援「租屋 + 買賣」的網頁版流程：

- 房源列表（可篩選租屋/買賣、城市、價格、關鍵字）
- 內部後台刊登/修改房源（不開放外部刊登）
- 房源詳情（地圖、收藏、LINE 官方帳號聯絡）
- 管理後台（`/admin`）：帳密登入、新增/修改房源、一鍵上架/下架、聯絡單處理與複製
- Prisma + PostgreSQL 資料模型

## Tech Stack

- `Next.js (App Router) + TypeScript + Tailwind`
- `Prisma + PostgreSQL`
- `Zod`（API 欄位驗證）

## Local Setup

1. 安裝套件

```bash
npm install
```

2. 設定環境變數

```bash
cp .env.example .env
```

3. 啟動 PostgreSQL（本機或雲端）

確保 `.env` 的以下內容已設定：

- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_TOKEN`（請使用長隨機字串）
- `NEXT_PUBLIC_LINE_OA_URL`（官方 LINE 連結，可選）
- `NEXT_PUBLIC_LINE_OA_ADD_FRIEND_URL`（加入 LINE 好友連結，可選）

4. 建立資料表

```bash
npx prisma migrate dev --name init
```

若你是從舊版本更新（新增聯絡表單資料表），再執行：

```bash
npx prisma migrate dev --name add_inquiry
```

若你是從舊版本更新（新增聯絡單處理狀態欄位），再執行：

```bash
npx prisma migrate dev --name add_inquiry_handled_status
```

5. 啟動開發環境

```bash
npm run dev
```

瀏覽 `http://localhost:3000`

## Notes

- 如果沒有設定 `DATABASE_URL`，首頁仍會顯示 mock 測試資料。
- 不提供公開刊登頁，僅內部登入後台進行新增/修改房源。
- 收藏功能採瀏覽器 `localStorage`，免登入即可使用。
- 後台登入入口：`/admin/login`，登入後可進入 `/admin`。
