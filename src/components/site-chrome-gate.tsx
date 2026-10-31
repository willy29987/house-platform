"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type SiteChromeGateProps = {
  children: React.ReactNode;
};

/** 後台與手機預覽頁不顯示前台 header / footer */
export function SiteChromeGate({ children }: SiteChromeGateProps) {
  const pathname = usePathname() ?? "";
  const hideChrome =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/mobile-preview") ||
    pathname.startsWith("/liff") ||
    pathname.startsWith("/line");

  return (
    <>
      {!hideChrome ? <SiteHeader /> : null}
      <div className="flex-1">{children}</div>
      {!hideChrome ? <SiteFooter /> : null}
    </>
  );
}
