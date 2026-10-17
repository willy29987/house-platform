export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logoNavy" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0b2545" />
        </linearGradient>
        <linearGradient id="logoGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4d58a" />
          <stop offset="100%" stopColor="#c9a24b" />
        </linearGradient>
      </defs>
      <path
        d="M28 3 L53 28 L28 53 L3 28 Z"
        fill="none"
        stroke="url(#logoNavy)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M16 30 L28 18 L40 30 V42 H33 V33 H23 V42 H16 Z" fill="url(#logoNavy)" />
      <path d="M28 11 L33 17 H23 Z" fill="url(#logoGold)" />
      <rect x="25.5" y="35" width="5" height="7" fill="#ffffff" opacity="0.95" />
    </svg>
  );
}
