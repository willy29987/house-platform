import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminListingForm, type AdminListingFormData } from "@/components/admin-listing-form";
import { GoPublicSiteButton } from "@/components/go-public-site-button";
import { getAdminListingById } from "@/lib/listings";
import { furnitureApplianceToFormTri } from "@/lib/furniture-appliance-value";

type AdminEditListingPageProps = {
  params: Promise<{ id: string }>;
};

function boolToTri(v: boolean | null | undefined): "" | "yes" | "no" {
  if (v === true) return "yes";
  if (v === false) return "no";
  return "";
}

export default async function AdminEditListingPage({ params }: AdminEditListingPageProps) {
  const { id } = await params;
  const listing = await getAdminListingById(id);

  if (!listing) {
    notFound();
  }

  const existingFeatures = listing.features ?? [];
  const features = Array.from({ length: 6 }, (_, i) => existingFeatures[i] ?? "");

  const initialData: AdminListingFormData = {
    title: listing.title,
    features,
    city: listing.city,
    district: listing.district,
    address: listing.address,
    community: listing.community ?? "",
    listingType: listing.listingType,
    propertyType: listing.propertyType as AdminListingFormData["propertyType"],
    price: listing.listingType === "SALE"
      ? String(listing.price / 10000)
      : String(listing.price),
    areaPing: String(listing.areaPing),
    areaMain: listing.areaMain ? String(listing.areaMain) : "",
    areaAncillary: listing.areaAncillary ? String(listing.areaAncillary) : "",
    areaCommon: listing.areaCommon ? String(listing.areaCommon) : "",
    areaLand: listing.areaLand ? String(listing.areaLand) : "",
    areaParkingSpace: listing.areaParkingSpace ? String(listing.areaParkingSpace) : "",
    parkingPrice: listing.parkingPrice ? String(listing.parkingPrice / 10000) : "",
    parkingSpaceInfo: listing.parkingSpaceInfo ?? "",
    parkingRent: listing.parkingRent ? String(listing.parkingRent) : "",
    parkingType: listing.parkingType ?? "",
    parkingIncluded: boolToTri(listing.parkingIncluded),
    managementFee: listing.managementFee ? String(listing.managementFee) : "",
    petsAllowed: boolToTri(listing.petsAllowed),
    taxDeductible: boolToTri(listing.taxDeductible),
    rentSubsidy: boolToTri(listing.rentSubsidy),
    canRegisterAddress: boolToTri(listing.canRegisterAddress),
    viewingMethod: (listing.viewingMethod as AdminListingFormData["viewingMethod"]) ?? "",
    buildingAge: listing.buildingAge ? String(listing.buildingAge) : "",
    orientation: listing.orientation ?? "",
    decorLevel: listing.decorLevel ?? "",
    usageZoning: listing.usageZoning ?? "",
    hasElevator: boolToTri(listing.hasElevator),
    legalUsage: listing.legalUsage ?? "",
    mrtLine: listing.mrtLine ?? "",
    mrtStation: listing.mrtStation ?? "",
    videoUrl: listing.videoUrl ?? "",
    rooms: String(listing.rooms),
    livingRooms: listing.livingRooms != null ? String(listing.livingRooms) : "",
    balconies: listing.balconies != null ? String(listing.balconies) : "",
    bathrooms: String(listing.bathrooms),
    floor: listing.floor ? String(listing.floor) : "",
    totalFloors: listing.totalFloors ? String(listing.totalFloors) : "",
    coverImage: listing.coverImage ?? "",
    images: listing.images ?? [],
    contactName: listing.contactName,
    contactPhone: listing.contactPhone,
    ownerIdCardUrl: listing.ownerIdCardUrl ?? "",
    furnitureProvided: furnitureApplianceToFormTri(listing.furnitureProvided),
    applianceProvided: furnitureApplianceToFormTri(listing.applianceProvided),
    shortTermRent: listing.shortTermRent ?? "",
    serviceFee: listing.serviceFee ?? "",
    registrationUse: listing.registrationUse ?? "",
    securityDeposit: listing.securityDeposit ?? "",
    availableFrom: listing.availableFrom ?? "",
    householdsPerFloor: listing.householdsPerFloor ?? "",
    isPublished: listing.isPublished,
  };

  const typeLabel = listing.listingType === "RENT" ? "租賃" : "買賣";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500">{typeLabel} 編輯</p>
            <h1 className="text-2xl font-bold text-zinc-900">編輯{typeLabel}廣告</h1>
          </div>
          <div className="flex items-center gap-2">
            <GoPublicSiteButton />
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              回管理後台
            </Link>
          </div>
        </div>
        <AdminListingForm
          mode="edit"
          submitUrl={`/api/admin/listings/${listing.id}`}
          initialData={initialData}
          lockedListingType={listing.listingType}
        />
      </section>
    </main>
  );
}
