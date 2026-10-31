-- AlterTable
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "source591Id" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "source591Url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Listing_source591Id_key" ON "Listing"("source591Id");
