import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin, requireAdminSession } from "@/lib/admin-auth";
import { parseListingInternalMeta, toListingDescription } from "@/lib/listing-internal-meta";
import { prisma } from "@/lib/prisma";
import { listingInputSchema } from "@/lib/listing-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const current = await getCurrentAdmin();
  if (!current) return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, message: "請先設定 DATABASE_URL 後再修改房源。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = listingInputSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)
      .filter(([, v]) => v && v.length > 0)
      .map(([k, v]) => `${k}: ${v![0]}`)
      .slice(0, 3)
      .join("；");
    return NextResponse.json(
      {
        ok: false,
        message: firstError ? `欄位格式不正確（${firstError}）` : "欄位格式不正確",
        errors: fieldErrors,
      },
      { status: 400 },
    );
  }

  const exists = await prisma.listing.findUnique({ where: { id }, select: { id: true, description: true } });
  if (!exists) {
    return NextResponse.json({ ok: false, message: "找不到房源。" }, { status: 404 });
  }
  const owner = parseListingInternalMeta(exists.description).createdByUsername;
  if (current.role !== "SUPER_ADMIN" && owner && owner !== current.username) {
    return NextResponse.json({ ok: false, message: "你只能修改自己刊登的廣告。" }, { status: 403 });
  }

  const data = parsed.data;
  try {
    await prisma.listing.update({
      where: { id },
      data: {
        title: data.title,
        description: toListingDescription({
          ...parseListingInternalMeta(exists.description),
          furnitureProvided: data.furnitureProvided ?? null,
          applianceProvided: data.applianceProvided ?? null,
          shortTermRent: data.shortTermRent ?? null,
          serviceFee: data.serviceFee ?? null,
          registrationUse: data.registrationUse ?? null,
          securityDeposit: data.securityDeposit ?? null,
          availableFrom: data.availableFrom ?? null,
          householdsPerFloor: data.householdsPerFloor ?? null,
        }),
        features: data.features ?? [],
        city: data.city,
        district: data.district,
        address: data.address,
        price: data.price,
        areaPing: data.areaPing,
        areaMain: data.areaMain ?? null,
        areaAncillary: data.areaAncillary ?? null,
        areaCommon: data.areaCommon ?? null,
        areaLand: data.areaLand ?? null,
        areaParkingSpace: data.areaParkingSpace ?? null,
        parkingPrice: data.parkingPrice ?? null,
        parkingSpaceInfo: data.parkingSpaceInfo ?? null,
        parkingRent: data.parkingRent ?? null,
        parkingType: data.parkingType ?? null,
        managementFee: data.managementFee ?? null,
        petsAllowed: data.petsAllowed ?? null,
        taxDeductible: data.taxDeductible ?? null,
        rentSubsidy: data.rentSubsidy ?? null,
        canRegisterAddress: data.canRegisterAddress ?? null,
        viewingMethod: data.viewingMethod ?? null,
        community: data.community ?? null,
        buildingAge: data.buildingAge ?? null,
        orientation: data.orientation ?? null,
        decorLevel: data.decorLevel ?? null,
        usageZoning: data.usageZoning ?? null,
        hasElevator: data.hasElevator ?? null,
        legalUsage: data.legalUsage ?? null,
        parkingIncluded: data.parkingIncluded ?? null,
        mrtLine: data.mrtLine ?? null,
        mrtStation: data.mrtStation ?? null,
        videoUrl: data.videoUrl ?? null,
        rooms: data.rooms,
        livingRooms: data.livingRooms ?? null,
        balconies: data.balconies ?? null,
        bathrooms: data.bathrooms,
        floor: data.floor ?? null,
        totalFloors: data.totalFloors ?? null,
        listingType: data.listingType,
        propertyType: data.propertyType,
        coverImage: data.coverImage ?? null,
        images: data.images ?? [],
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        ownerIdCardUrl: data.ownerIdCardUrl ?? null,
        isPublished: data.isPublished ?? true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/listings PATCH]", error);
    const message = error instanceof Error ? error.message : "更新房源時發生未知錯誤";
    return NextResponse.json(
      { ok: false, message: `儲存失敗：${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const current = await getCurrentAdmin();
  if (!current) return NextResponse.json({ ok: false, message: "未授權" }, { status: 401 });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, message: "請先設定 DATABASE_URL 後再刪除房源。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const exists = await prisma.listing.findUnique({ where: { id }, select: { description: true } });
  if (!exists) return NextResponse.json({ ok: false, message: "找不到房源。" }, { status: 404 });
  const owner = parseListingInternalMeta(exists.description).createdByUsername;
  if (current.role !== "SUPER_ADMIN" && owner && owner !== current.username) {
    return NextResponse.json({ ok: false, message: "你只能刪除自己刊登的廣告。" }, { status: 403 });
  }
  await prisma.listing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
