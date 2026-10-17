# Vercel 後台 · 同事可用（管理員勾選清單）

完成後同事在你電腦關機時仍可操作後台。詳細說明見 [colleague-admin-guide.md](./colleague-admin-guide.md)。

- [ ] **正式網址**：手機關 Wi‑Fi 用 4G 開 `https://你的網域/admin/login`，能出現登入頁（勿測 localhost）
- [ ] **公網自檢**：`PRODUCTION_SITE_URL=https://你的網域 npm run verify:production` 全 ✓
- [ ] **Health**：SUPER_ADMIN 登入後開 `/api/admin/health`，`ok: true`、`onVercel: true`，DB 與 Storage 為 ok
- [ ] **帳號**：`/admin/settings` → 帳號管理，為每位同事新增 **業務（OPERATOR）**
- [ ] **通知同事**：寄出 [colleague-admin-guide.md §給同事](./colleague-admin-guide.md#給同事複製貼上給新進同仁) 文案（網址 + 帳密 + 簡要流程）
- [ ] **（選配）分網域**：Vercel 綁 `staff.*`，設 `PUBLIC_SITE_HOST` / `ADMIN_SITE_HOST`（[DEPLOYMENT.md §3.4](../DEPLOYMENT.md)）
