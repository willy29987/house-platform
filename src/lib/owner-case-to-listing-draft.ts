import type { AdminListingFormData } from "@/components/admin-listing-form";
import type { OwnerCasePreview } from "@/lib/owner-tracking-preview";
import { createEmptyFormData } from "@/lib/listing-form-defaults";
import {
  inferManagementFee,
  inferParkingPrice,
  inferPets,
  inferRentSubsidy,
  parseLayoutStored,
} from "@/lib/owner-tracking-form-ui";
import { PROPERTY_TYPE_OPTIONS, type PropertyTypeOption } from "@/lib/property-type-label";
import { parseTaiwanAddress } from "@/lib/taiwan-address";

export { parseTaiwanAddress } from "@/lib/taiwan-address";

function resolvePropertyType(code: string): PropertyTypeOption {
  if ((PROPERTY_TYPE_OPTIONS as readonly string[]).includes(code)) {
    return code as PropertyTypeOption;
  }
  return "APARTMENT";
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

/** 屋主追蹤案件 → 租賃上架表單初值（仍須補照片、缺漏欄位等）。 */
export function ownerCaseToListingDraft(
  ownerCase: OwnerCasePreview,
  listingType: "RENT" | "SALE" = "RENT",
): AdminListingFormData {
  const base = createEmptyFormData(listingType);
  const layout = parseLayoutStored(ownerCase.layout);
  const parsed = parseTaiwanAddress(ownerCase.address);
  const city = ownerCase.city.trim() || parsed.city;
  const district = ownerCase.district.trim() || parsed.district;
  const address = ownerCase.address.trim() || parsed.address;
  const mgmt = inferManagementFee(ownerCase.managementFee);
  const parkingPrice = inferParkingPrice(ownerCase.parkingPrice);
  const pets = inferPets(ownerCase.pets);
  const subsidy = inferRentSubsidy(ownerCase.rentSubsidy);

  return {
    ...base,
    title: "",
    features: [...base.features],
    layoutOpenLayoutInitial: layout.openLayout,
    city,
    district,
    address,
    community: ownerCase.community.trim(),
    propertyType: resolvePropertyType(ownerCase.propertyType),
    price: digitsOnly(ownerCase.rent),
    floor: ownerCase.floor.trim() ? ownerCase.floor.trim() : "",
    totalFloors: ownerCase.totalFloors.trim() ? ownerCase.totalFloors.trim() : "",
    areaPing: digitsOnly(ownerCase.areaPing),
    managementFee: mgmt.mode === "separate" ? digitsOnly(mgmt.amount) : "",
    otherFees: ownerCase.otherFees.trim(),
    petsAllowed: pets === "yes" ? "yes" : pets === "no" ? "no" : "",
    rentSubsidy: subsidy === "eligible" ? "yes" : subsidy === "ineligible" ? "no" : "",
    parkingType: ownerCase.parking.trim(),
    parkingSpaceInfo: ownerCase.parkingNumber.trim(),
    parkingRent:
      ownerCase.parking.trim() && parkingPrice.mode === "separate"
        ? digitsOnly(parkingPrice.amount)
        : "",
    serviceFee: ownerCase.serviceFee.trim(),
    specialMatters: ownerCase.specialMatters.trim(),
    contactName: ownerCase.ownerName.trim(),
    contactPhone: ownerCase.phone.trim(),
    source591Url: ownerCase.listingUrl.trim(),
    rooms: layout.rooms.trim(),
    livingRooms: layout.living.trim(),
    bathrooms: layout.bath.trim(),
    balconies: layout.balcony.trim(),
    isPublished: true,
  };
}
