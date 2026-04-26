-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "buildingAge" DOUBLE PRECISION,
ADD COLUMN     "community" TEXT,
ADD COLUMN     "decorLevel" TEXT,
ADD COLUMN     "hasElevator" BOOLEAN,
ADD COLUMN     "legalUsage" TEXT,
ADD COLUMN     "orientation" TEXT,
ADD COLUMN     "parkingIncluded" BOOLEAN,
ADD COLUMN     "usageZoning" TEXT,
ADD COLUMN     "videoUrl" TEXT;
