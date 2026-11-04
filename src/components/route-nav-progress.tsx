"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const ROUTE_NAV_EVENT = "house-platform:route-nav";

/** router.push 等非 <Link> 導航時呼叫，立刻顯示進度條 */
export function markRouteNavigating() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ROUTE_NAV_EVENT));
}

/**
 * 點擊站內連結後立即顯示頂部進度條（目標：200ms 內有畫面回饋），
 * 等 pathname／search 變更後收起。
 */
function RouteNavProgressInner() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeKey = `${pathname}?${search}`;
  const routeKeyRef = useRef(routeKey);

  const startProgress = () => {
    setVisible(true);
    setActive(true);
  };

  useEffect(() => {
    routeKeyRef.current = routeKey;
    if (!active) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setActive(false);
      setVisible(false);
    }, 160);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [routeKey, active]);

  useEffect(() => {
    const onManual = () => startProgress();
    window.addEventListener(ROUTE_NAV_EVENT, onManual);
    return () => window.removeEventListener(ROUTE_NAV_EVENT, onManual);
  }, []);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;
      if (hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
      if (nextKey === routeKeyRef.current) return;

      startProgress();
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent"
      role="progressbar"
      aria-label="頁面載入中"
    >
      <div
        className={`h-full w-full bg-[#0b2545] ${active ? "route-nav-progress-bar" : ""}`}
        style={active ? undefined : { transform: "scaleX(1)" }}
      />
    </div>
  );
}

export function RouteNavProgress() {
  return (
    <Suspense fallback={null}>
      <RouteNavProgressInner />
    </Suspense>
  );
}
