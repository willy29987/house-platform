# 591 租賃本機 Agent

官網為主：後台上下架／儲存會排程任務，本機程式用你登入過的瀏覽器去操作 591。

## 設定

1. 後台 → 系統設定 →「591 本機連動」產生 Agent Token（只顯示一次）。
2. 複製 `apps/591-agent/.env.example` 為 `.env`，填入：

```bash
HOUSE_PLATFORM_URL=https://house-platform.vercel.app
AGENT_TOKEN=hp591_xxxxx
AGENT_LABEL=office-mac
```

3. 安裝：

```bash
cd apps/591-agent
npm install
npm run install-browsers
```

4. **先登入一次 591**（會開瀏覽器，請用仲介帳號登入租屋後台）：

```bash
npm run login
```

5. 常駐跑：

```bash
npm start
```

電腦需保持開機、勿睡眠。登入過期時後台會顯示「需重新登入本機」，再跑一次 `npm run login`。

## 到期日提醒

Agent 約每 6 小時會排程掃一次「有 591 案號的租賃」到期日；也可在後台「系統設定 → 591 本機連動」按「掃描全部到期日」。
抓到的日期寫回本站後，後台首頁會顯示「591 廣告即將到期」（7 天內含已過期）。

## 注意

- 只處理租賃；591 改版可能需更新 `src/actions/*.mjs` 選擇器（含到期日文字）。
- 勿把 `AGENT_TOKEN` 與使用者資料目錄提交到 git。
