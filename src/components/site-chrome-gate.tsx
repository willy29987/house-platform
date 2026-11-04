"use client";

import { usePathname } from "next/navigation";
import { RouteNavProgress } from "@/components/route-nav-progress";
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
      {/* 後台自己有進度條；前台／LIFF 等在此補上，點擊後 0.2s 內有回饋 */}
      {hideChrome && !pathname.startsWith("/admin") ? <RouteNavProgress /> : null}
      {!hideChrome ? (
        <>
          <RouteNavProgress />
          <SiteHeader />
        </>
      ) : null}
      <div className="flex-1">{children}</div>
      {!hideChrome ? <SiteFooter /> : null}
    </>
  );
}
