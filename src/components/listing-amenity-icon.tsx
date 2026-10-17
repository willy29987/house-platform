import type { ReactNode } from "react";

/** 設備／家具／建物項目的線條圖示（24x24，使用 currentColor）。 */
const ICONS: Record<string, ReactNode> = {
  冰箱: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M6 10h12M9 6v2M9 13v3" />
    </>
  ),
  洗衣機: (
    <>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <circle cx="12" cy="13.5" r="4.2" />
      <path d="M8 6h.01M11 6h.01" />
    </>
  ),
  電視: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16.5V20" />
    </>
  ),
  冷氣: (
    <>
      <rect x="3" y="4.5" width="18" height="8" rx="2" />
      <path d="M7 15.5c0 1.2-.8 1.5-.8 2.7M12 15.5c0 1.2-.8 1.5-.8 2.7M17 15.5c0 1.2-.8 1.5-.8 2.7M6 9h6" />
    </>
  ),
  熱水器: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="3" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M9.5 15.5h5" />
    </>
  ),
  網路: (
    <>
      <path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.5 16a6 6 0 0 1 7 0" />
      <path d="M12 19.5h.01" />
    </>
  ),
  第四台: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">
        4+
      </text>
    </>
  ),
  天然瓦斯: (
    <>
      <path d="M12 3c.5 3.5-3.5 5-3.5 9.5a3.5 3.5 0 0 0 7 0c0-1.5-.7-2.5-1.5-3.5-.2 1.2-1 1.8-1.8 2C12.5 8.5 12.8 5.5 12 3Z" />
      <path d="M8 20.5h8" />
    </>
  ),
  床: (
    <>
      <path d="M3 18V7M3 14h18v4M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5" />
      <circle cx="7" cy="11" r="1.6" />
    </>
  ),
  衣櫃: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M12 3v18M9.5 11v2M14.5 11v2M7 21v1.5M17 21v1.5" />
    </>
  ),
  沙發: (
    <>
      <path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
      <path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5Z" />
      <path d="M6 18v2M18 18v2" />
    </>
  ),
  桌子: <path d="M3 9h18M6 9v11M18 9v11M9 13h6" />,
  椅子: <path d="M7 3v9M7 12h10M17 12v9M7 12v9M7 16h10" />,
  陽台: <path d="M3 10h18M3 20h18M6 10v10M10 10v10M14 10v10M18 10v10" />,
  電梯: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M12 3v18M7.5 9.5 9 8l1.5 1.5M13.5 14.5 15 16l1.5-1.5" />
    </>
  ),
  車位: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 17V7h3a3 3 0 0 1 0 6h-3" />
    </>
  ),
};

export function AmenityIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
