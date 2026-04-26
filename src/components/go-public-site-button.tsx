import Link from "next/link";

type GoPublicSiteButtonProps = {
  href?: string;
  className?: string;
};

export function GoPublicSiteButton({ href = "/", className = "" }: GoPublicSiteButtonProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 ${className}`}
    >
      前往外網 ↗
    </Link>
  );
}
