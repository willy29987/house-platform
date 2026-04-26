import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingInputSchema } from "@/lib/listing-validation";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, message: "請先設定 DATABASE_URL 後再建立房源。" },
      { status: 400 },
    );
  }

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

  const data = parsed.data;
  try {
    const listing = await prisma.listing.create({
      data: {
        title: data.title,
        description: data.description ?? "",
        features: data.features ?? [],
        city: data.city,
        district: data.district,
        address: data.address,
        price: data.price,
        areaPing: data.areaPing,
        areaMain: data.areaMain ?? null,
        areaAncillary: data.areaAncillary ?? null,
        areaParkingSpace: data.areaParkingSpace ?? null,
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
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: listing.id });
  } catch (error) {
    console.error("[api/admin/listings POST]", error);
    const message = error instanceof Error ? error.message : "建立房源時發生未知錯誤";
    return NextResponse.json(
      { ok: false, message: `儲存失敗：${message}` },
      { status: 500 },
    );
  }
}
