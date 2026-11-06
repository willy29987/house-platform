"use client";

/** 左側選項、右側金額。另計時選項維持固定寬度，避免被金額框蓋住。 */
export function SplitChoiceField({
  value,
  onChange,
  disabled = false,
  compact,
  options,
  amount = "",
  onAmountChange,
  amountPlaceholder,
  amountLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact: boolean;
  options: readonly { value: string; label: string }[];
  amount?: string;
  onAmountChange?: (value: string) => void;
  amountPlaceholder?: string;
  amountLabel: string;
}) {
  return (
    <div
      className={`flex h-[42px] items-stretch overflow-hidden rounded-lg border border-zinc-300 ${
        disabled ? "bg-zinc-100" : "bg-white"
      }`}
    >
      <div className={`relative h-full ${compact ? "w-[6.5rem] shrink-0" : "min-w-0 flex-1"}`}>
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-full w-full appearance-none border-0 bg-transparent py-2 pl-3 pr-8 text-sm focus:outline-none disabled:text-zinc-400"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
          aria-hidden
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {compact && onAmountChange ? (
        <>
          <div className="w-px shrink-0 self-stretch bg-zinc-200" aria-hidden />
          <input
            type="text"
            lang="zh-Hant"
            autoComplete="off"
            value={amount}
            disabled={disabled}
            onChange={(event) => onAmountChange(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-0 disabled:text-zinc-400"
            placeholder={amountPlaceholder}
            aria-label={amountLabel}
          />
        </>
      ) : null}
    </div>
  );
}
