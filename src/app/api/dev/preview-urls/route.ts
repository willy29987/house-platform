import os from "node:os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getLanIpv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const ips = new Set<string>();
  for (const iface of Object.values(nets)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        ips.add(addr.address);
      }
    }
  }
  return [...ips];
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path")?.trim() || "/mobile-preview";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const port = process.env.PORT ?? "3000";
  const hostHeader = request.headers.get("host");
  const hostPort = hostHeader?.includes(":") ? hostHeader.split(":")[1] : port;
  const effectivePort = hostPort || port;

  const localhostBase = `http://127.0.0.1:${effectivePort}`;
  const lanIps = getLanIpv4Addresses();
  const lanBases = lanIps.map((ip) => `http://${ip}:${effectivePort}`);

  const publicHost = process.env.PUBLIC_SITE_HOST?.trim();
  const publicBase = publicHost ? `https://${publicHost.replace(/^https?:\/\//, "")}` : null;

  const adminHost = process.env.ADMIN_SITE_HOST?.trim();
  const adminBase = adminHost ? `https://${adminHost.replace(/^https?:\/\//, "")}` : null;

  return NextResponse.json({
    path: normalizedPath,
    port: effectivePort,
    localhost: `${localhostBase}${normalizedPath}`,
    lan: lanBases.map((base) => `${base}${normalizedPath}`),
    public: publicBase ? `${publicBase}${normalizedPath}` : null,
    admin: adminBase ? `${adminBase}${normalizedPath}` : null,
    envHints: {
      public: publicHost ? null : "於 .env 設定 PUBLIC_SITE_HOST（外網網域，不含 https://）",
      admin: adminHost ? null : "於 .env 設定 ADMIN_SITE_HOST（內網／後台網域，不含 https://）",
    },
  });
}
