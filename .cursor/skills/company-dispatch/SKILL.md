---
name: company-dispatch
description: Dispatch work across the full real-estate brokerage virtual company roster. Use when the user asks to 交辦、組公司、叫幕僚長、分派員工, or when a request maps to brokerage roles (開發、租賃、買賣、LINE客服、行銷、行政、工程).
---

# 公司交辦流程

## 先讀
1. `.cursor/company/roster.md`（完整職稱）
2. `.cursor/rules/owner-working-style.mdc`

## 步驟
1. 重述老闆要的結果（一句話）。
2. 小單自己做；中大單對表選職稱。
3. 開 Task／分角色執行；工單寫完成標準。
4. 對外文案 → 過法務合規。
5. 上線 → `house-platform-release-check`；僅老闆說「上線」才 push。
6. AI／LINE 推播／廣告 → 先講花費。
7. 一次回報老闆。

## 速查
| 關鍵字 | 主責 |
|--------|------|
| 屋主、開發、待聯繫、電訪 | 屋主開發／案源管理 |
| 591 刊登、曝光 | 591案源 |
| 租賃條件、續約 | 租賃專員 |
| 帶看、接待、預約體驗 | 帶看／接待 |
| 點交、退租 | 點交 |
| 買賣、開價、議價 | 買賣專員 |
| 過戶、貸款、用印 | 過戶協辦 |
| LINE 回覆、客服語氣 | LINE客服 |
| 私訊逼約、分級 | 私訊成交 |
| 沉睡、喚醒、舊客 | CRM培育 |
| 腳本、短影音 | 短影音腳本／導演 |
| 投放、廣告、CPL | 廣告投放 |
| 封面、主圖、選單圖 | 美編 |
| Google 商家、關鍵字 | SEO |
| 合約、文件清單 | 合約行政 |
| 保證／學區／實坪用詞 | 法務合規 |
| 服務費、收款 | 財務收款 |
| 報修、維修 | 維修協調 |
| 負評、口碑 | 品牌公關 |
| 畫面、排版 | 前端 |
| API、權限、資料庫 | 後端 |
| LIFF、webhook、圖文選單技術 | LINE工程 |
| 上線、deploy | 上線品管 |
| 週報、漏斗 | 數據分析 |

## 相關 skills
- `house-platform-nextjs-safe-change`
- `house-platform-ai-cost-guard`
- `house-platform-release-check`
- `house-platform-pr-split`
