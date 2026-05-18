---
description: 
alwaysApply: true
---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 響應式／只改手機版時（house-platform）

- **手機優先**：預設樣式當小螢幕；桌機用 `sm:` / `md:` / `lg:` **加**樣式，不要反過來改掉共用的預設而沒加斷點。
- **只改小螢幕**時優先用 **`max-sm:` / `max-md:`** 等，避免動到 `md:` 以上已穩定的桌機配置。
- **不要**為了手機刪掉桌機用的 `grid-cols-*`、`padding`、`gap`；改為在小斷點覆寫（例如 `grid-cols-1 md:grid-cols-3`）。
- 改完在 **寬約 390px 與 ≥1024px** 兩種寬度下都應合理；若只接到「手機」需求，仍應快速確認桌機未被連帶改壞。
