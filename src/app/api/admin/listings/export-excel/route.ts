import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminListingRecords } from "@/lib/listings";
import { buildListingsWorkbook } from "@/lib/excel-export";

export async function GET() {
  const guard = await requireAdminSession();
  if (guard) return guard;

  const records = await getAdminListingRecords();
  const buffer = await buildListingsWorkbook(records);

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
