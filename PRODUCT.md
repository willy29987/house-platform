# 不動產實踐家（house-platform）

## Who it is for
- **客人**：在 LINE LIFF 找租屋、預約看屋、回覆客服
- **業務／主管**：在後台做屋主追蹤、物件刊登、當日電訪、LINE 客服
- **老闆**：看營運數字、控制成本與上線品質

## What it needs to do
- 租賃為主、兼做買賣；案源來自 591 與屋主追蹤
- LIFF：開得快（首屏目標約 0.2 秒有反應）、流程短、少點擊
- 後台：列表密度精簡、欄位對齊、少一個點擊算一個
- 品牌「不動產實踐家」：可信、清楚、不動產實務感，不是潮牌行銷站

## Constraints
- **Platform:** web（Next.js App Router + Tailwind）；客人面含 LINE LIFF
- **Mode mix:** LIFF／後台＝Operate；官網宣傳頁＝Persuade（有限）
- **視覺：** 藍色系為主（`#0b2545`／`#1e3a8a`），間距精簡；只說改排版就不要亂改顏色
- **響應式：** 手機優先；改完需在約 390px 與 ≥1024px 都合理；LIFF 以小屏為準
- **速度：** 避免重動畫、大圖未壓縮、卡片牆；LIFF 動效克制
- **文案：** 繁體中文；對外保證／學區／實坪等敏感宣稱需合規
- **AI 設計：** refinement 優先，保留既有品牌與結構；禁止紫漸層、通用 Inter 潮站、卡片套卡片的 AI 預設皮
- **上線：** 未說「上線」不要 push；敏感權限預設 SUPER_ADMIN

## Design authority
- 既有程式與畫面是現況真相；`DESIGN.md` 記錄視覺系統
- 美化指令預設 **refinement**，不要整站換皮，除非明確說 redesign
