"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

const WIDTH_PRESETS = [
  { label: "375", w: 375 },
  { label: "390", w: 390 },
  { label: "414", w: 414 },
  { label: "428", w: 428 },
] as const;

const SITE_QUICK_PATHS = [
  { label: "首頁", path: "/" },
  { label: "租屋", path: "/rent" },
  { label: "售屋", path: "/sale" },
  { label: "搜尋", path: "/search" },
] as const;

const ADMIN_QUICK_PATHS = [
  { label: "後台首頁", path: "/admin" },
  { label: "新增租賃", path: "/admin/listings/new?type=rent" },
  { label: "新增買賣", path: "/admin/listings/new?type=sale" },
  { label: "刊登紀錄", path: "/admin/listings/records" },
] as const;

type PreviewUrls = {
  path: string;
  port: string;
  localhost: string;
  lan: string[];
  public: string | null;
  admin: string | null;
  envHints: { public: string | null; admin: string | null };
};

function normalizePath(raw: string) {
  const t = raw.trim();
  if (!t) return "/";
  return t.startsWith("/") ? t : `/${t}`;
}

function isPrivateLanHost(host: string) {
  const h = host.split(":")[0] ?? host;
  if (h === "localhost" || h === "127.0.0.1") return false;
  return (
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  );
}

function lanOriginFromUrls(urls: PreviewUrls | null) {
  const first = urls?.lan?.[0];
  if (!first) return null;
  try {
    const u = new URL(first);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-800/60 px-2 py-1.5 text-[11px]">
      <span className="shrink-0 text-zinc-400">{label}</span>
      <code className="min-w-0 flex-1 break-all text-emerald-300">{url}</code>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(url)}
        className="shrink-0 text-zinc-300 underline-offset-2 hover:underline"
      >
        複製
      </button>
    </div>
  );
}

function MobilePreviewInner() {
  const searchParams = useSearchParams();
  const isAdminScope = searchParams.get("scope") === "admin";
  const forceLan = searchParams.get("lan") === "1";
  const pathFromQuery = searchParams.get("path");

  const [path, setPath] = useState(() =>
    normalizePath(pathFromQuery || (isAdminScope ? "/admin" : "/")),
  );
  const [width, setWidth] = useState<number>(390);
  const [urls, setUrls] = useState<PreviewUrls | null>(null);

  useEffect(() => {
    const next = normalizePath(pathFromQuery || (isAdminScope ? "/admin" : "/"));
    setPath(next);
  }, [pathFromQuery, isAdminScope]);

  const loadUrls = useCallback(async () => {
    const q = encodeURIComponent(normalizePath(path));
    const res = await fetch(`/api/dev/preview-urls?path=${q}`);
    if (!res.ok) return;
    setUrls((await res.json()) as PreviewUrls);
  }, [path]);

  useEffect(() => {
    void loadUrls();
  }, [loadUrls]);

  const previewOrigin = useMemo(() => {
    if (forceLan) {
      const fromApi = lanOriginFromUrls(urls);
      if (fromApi) return fromApi;
      if (typeof window !== "undefined" && isPrivateLanHost(window.location.hostname)) {
        return window.location.origin;
      }
    }
    if (typeof window !== "undefined" && isPrivateLanHost(window.location.hostname)) {
      return window.location.origin;
    }
    if (typeof window !== "undefined") return window.location.origin;
    return lanOriginFromUrls(urls) ?? null;
  }, [forceLan, urls]);

  const iframeSrc = useMemo(() => {
    const p = normalizePath(path);
    if (previewOrigin) return `${previewOrigin}${p}`;
    return p;
  }, [path, previewOrigin]);

  const previewModeLabel = useMemo(() => {
    const prefix = isAdminScope ? "後台" : "前台";
    if (forceLan || (typeof window !== "undefined" && isPrivateLanHost(window.location.hostname))) {
      if (previewOrigin) {
        try {
          return `${prefix} · ${new URL(previewOrigin).host}`;
        } catch {
          return prefix;
        }
      }
      return prefix;
    }
    return `${prefix} · 本機`;
  }, [forceLan, previewOrigin, isAdminScope]);

  const quickPaths = isAdminScope ? ADMIN_QUICK_PATHS : SITE_QUICK_PATHS;

  return (
    <div className="flex h-full min-h-0 flex-col text-zinc-100">
      <header className="shrink-0 border-b border-zinc-700/80 bg-zinc-900/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-bold text-white sm:text-base">
              {isAdminScope ? "後台手機預覽" : "手機版預覽"}
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isAdminScope
                  ? "bg-amber-900/80 text-amber-100 ring-1 ring-amber-600/50"
                  : previewModeLabel.includes("本機")
                    ? "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600"
                    : "bg-emerald-900/80 text-emerald-200 ring-1 ring-emerald-600/50"
              }`}
            >
              {previewModeLabel}
            </span>
          </div>
          <Link
            href={isAdminScope ? "/admin" : "/"}
            className="rounded-md border border-zinc-600 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            離開
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500">路徑</span>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onBlur={() => setPath((p) => normalizePath(p))}
              className="rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-white"
              placeholder={isAdminScope ? "/admin" : "/rent"}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500">寬度</span>
            <select
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-white"
            >
              {WIDTH_PRESETS.map((p) => (
                <option key={p.w} value={p.w}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1">
            {quickPaths.map((q) => (
              <button
                key={q.path}
                type="button"
                onClick={() => setPath(q.path)}
                className="rounded-md border border-zinc-600 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-1.5 truncate text-[10px] text-zinc-500">
          iframe：<span className="text-emerald-400/90">{iframeSrc}</span>
        </p>
        {isAdminScope ? (
          <p className="mt-1 text-[10px] text-amber-200/90">
            登入請用 <strong className="font-semibold">R001</strong>（.env 密碼），按「登入後台」即可。
            <a
              href={`${typeof window !== "undefined" ? window.location.origin : ""}/admin/login?next=${encodeURIComponent("/admin")}`}
              target="_top"
              className="ml-1 underline"
            >
              全螢幕登入
            </a>
          </p>
        ) : null}

        {urls ? (
          <details className="group mt-2">
            <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-400 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="text-zinc-300 group-open:text-emerald-300">▸ 開發網址</span>
              <span className="ml-1 text-zinc-500">（僅供複製）</span>
            </summary>
            <div className="mt-2 flex max-h-28 flex-col gap-1.5 overflow-y-auto">
              <UrlRow label="本機" url={urls.localhost} />
              {urls.lan.map((lanUrl) => (
                <UrlRow key={lanUrl} label="區網 IP" url={lanUrl} />
              ))}
              {urls.public ? <UrlRow label="正式外網" url={urls.public} /> : null}
              {urls.admin ? <UrlRow label="後台網域" url={urls.admin} /> : null}
            </div>
          </details>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2 sm:p-3">
        <div
          className="flex h-full max-h-full min-h-0 flex-col rounded-[2rem] border-[10px] border-zinc-950 bg-zinc-950 shadow-2xl ring-1 ring-white/10"
          style={{
            width: `min(${width}px, calc(100vw - 1rem))`,
            height: "min(100%, calc(100dvh - 5.5rem))",
          }}
        >
          <div className="flex h-5 shrink-0 items-center justify-center rounded-t-[1.25rem] bg-zinc-900">
            <span className="h-1 w-8 rounded-full bg-zinc-700" />
          </div>
          <iframe
            title={isAdminScope ? "後台手機預覽" : "手機預覽"}
            src={iframeSrc}
            className="min-h-0 w-full flex-1 rounded-b-[1.35rem] bg-white"
          />
        </div>
      </div>
    </div>
  );
}

export default function MobilePreviewPage() {
  return (
    <Suspense
      fallback={<div className="flex h-full items-center justify-center text-sm text-zinc-400">載入預覽…</div>}
    >
      <MobilePreviewInner />
    </Suspense>
  );
}
