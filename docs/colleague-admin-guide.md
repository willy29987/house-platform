# 同事後台使用說明（Vercel 正式站）

網站部署在 **Vercel + Supabase** 上，**不需要**任何同事的電腦開機，也不需要連公司某台筆電。只要用 **HTTPS 正式網址** 登入即可。

---

## 給管理員：開通同事（5 分鐘）

1. 登入正式站後台（不要用 `localhost`）  
   - 例：`https://你的專案.vercel.app/admin/login`  
   - 或自訂：`https://staff.你的網域/admin/login`
2. 進 **帳號管理**：`/admin/settings`
3. **新增帳號**  
   - 角色：**業務（OPERATOR）**（一般同事）  
   - 設定帳號、密碼、顯示名稱（選填）
4. 把下面「給同事」區塊複製後，填入網址與帳密，用 Line / Email 私下傳給對方。

### 驗收正式站是否正常

在本機專案目錄執行（把網址換成你的 Vercel 或自訂網域）：

```bash
PRODUCTION_SITE_URL=https://你的專案.vercel.app npm run verify:production
```

登入後台後，瀏覽器開 `/api/admin/health`，應為 `ok: true` 且 `onVercel: true`（詳見 [DEPLOYMENT.md](../DEPLOYMENT.md)）。

---

## 給同事：複製貼上給新進同仁

```
【不動產實踐家 · 後台登入】

登入網址：（請管理員填入）
https://_______________/admin/login

帳號：_______________
密碼：_______________（首次登入後請自行記好，遺失請找管理員重設）

使用方式：
1. 用 Chrome / Safari 開啟上方網址（請加入書籤，不要用 localhost）
2. 登入後可：新增/編輯物件、上架下架、查看「我刊登」與「回租」
3. 外網預覽：物件卡片或「外網」按鈕

注意：
· 屋主追蹤、服務費、房客管理已同步 Supabase 雲端；若資料是在 **localhost** 建的，請在本機登入後台各開一次對應頁面，會自動上傳。物件刊登與圖片本來就在雲端。
· 任何時間都可使用，與辦公室電腦是否開機無關。
```

---

## 權限說明

| 角色 | 能做什麼 |
|------|----------|
| **業務** | 新增/編輯/上下架 **自己刊登** 的物件；**回租** 只看自己的釋出案 |
| **最高管理員** | 全部物件、帳號管理、資料紀錄匯出、房客管理等 |

---

## 常見問題

**Q：以前給的 localhost 連結打不開？**  
A：請改用管理員提供的 **https://…vercel.app** 或正式網域。

**Q：登入後沒有物件？**  
A：業務在「我刊登」看自己建的案；或請管理員確認 Vercel 已設定 `DATABASE_URL`（health 檢查）。

**Q：上傳圖片失敗？**  
A：請管理員確認 Supabase Storage bucket `listing-media` 與 Vercel 環境變數（見 DEPLOYMENT.md）。

---

## （選配）外網 / 後台分網域

若要用 `urhouse.tw` 給客戶、`staff.urhouse.tw` 給同事，請管理員依 [DEPLOYMENT.md §3.4](../DEPLOYMENT.md) 設定 `PUBLIC_SITE_HOST` 與 `ADMIN_SITE_HOST` 並在 Vercel 綁定兩個網域。
