-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "canRegisterAddress" BOOLEAN,
ADD COLUMN     "features" TEXT[],
ADD COLUMN     "managementFee" INTEGER,
ADD COLUMN     "parkingRent" INTEGER,
ADD COLUMN     "parkingType" TEXT,
ADD COLUMN     "petsAllowed" BOOLEAN,
ADD COLUMN     "rentSubsidy" BOOLEAN,
ADD COLUMN     "taxDeductible" BOOLEAN,
ADD COLUMN     "viewingMethod" TEXT,
ALTER COLUMN "description" SET DEFAULT '';
