-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "areaAncillary" DOUBLE PRECISION,
ADD COLUMN     "areaMain" DOUBLE PRECISION,
ADD COLUMN     "areaParkingSpace" DOUBLE PRECISION,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "parkingSpaceInfo" TEXT;
