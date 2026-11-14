# Design system — 不動產實踐家

## Visual world
務實、清楚、可信的房仲產品介面。藍色權威、白／淺灰底、精簡間距。  
不是潮牌站、不是紫色 AI 預設、不是大圓角卡片牆。

## Color
- **Brand navy:** `#0b2545`（主按鈕、標題強調、徽章）
- **Brand blue:** `#1e3a8a`（連結、次強調）
- **Surface:** white / `zinc-50`～`zinc-100`
- **Border:** `zinc-200`
- **Text:** `zinc-900` 主文、`zinc-600` 次文、`zinc-400` 提示
- **狀態：** emerald 成功、sky 可帶看、violet 持續聯繫、red 危險操作
- 只說「改排版」時：**不要改色票**

## Typography
- 系統／Tailwind 預設即可；繁中優先可讀，不要為了「高級感」硬上無關展示襯線
- 層級靠字重與尺寸，不靠裝飾線堆疊

## Layout & density
- **手機優先**；桌機用 `sm:` / `md:` / `lg:` 加樣式
- 間距精簡；同排對齊；少一個點擊算一個
- 後台列表：資訊密度高但可掃讀；避免無意義卡片套卡片
- LIFF：首屏只放必要操作；重資料延後載入

## Components
- 按鈕：實心 navy 主行動、虛線／淺底次要上傳
- 表單：圓角 `rounded-lg`～`rounded-xl`，框線克制
- 徽章：小 pill 可，但不要一排裝飾 pill 堆
- 空狀態／錯誤：短、可行動

## Motion
- 目標：點擊後約 0.2 秒內有畫面回應
- LIFF／後台：克制；不要 scroll-driven、shader、大進場動畫

## Modes
- **Operate（預設）：** `/admin/*`、LIFF 找房／預約、屋主追蹤
- **Persuade（有限）：** 官網行銷區塊；仍須品牌藍與真實物件圖，禁止通用 AI 皮

## Refinement rules for agents
1. 先讀現況再改；保留既有路由、文案事實、藍色系
2. 390px 與 ≥1024 都要過
3. 不要引入 Inter＋紫漸層＋嵌套卡片的預設組合
4. 未要求 redesign 就做 refinement
