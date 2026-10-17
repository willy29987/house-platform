import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminListingRecords } from "@/lib/listings";
import { buildListingsWorkbook } from "@/lib/excel-export";

export async function GET(request: Request) {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const origin = new URL(request.url).origin;
  const publicHost = process.env.PUBLIC_SITE_HOST?.trim();
  const adminHost = process.env.ADMIN_SITE_HOST?.trim();
  const publicBaseUrl = publicHost
    ? `https://${publicHost.replace(/^https?:\/\//, "")}`
    : origin;
  const adminBaseUrl = adminHost
    ? `https://${adminHost.replace(/^https?:\/\//, "")}`
    : origin;

  const records = await getAdminListingRecords();
  const buffer = await buildListingsWorkbook(records, { publicBaseUrl, adminBaseUrl });

  const today = new Date().toISOString().slice(0, 10);
  const filename = `listings-${today}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
