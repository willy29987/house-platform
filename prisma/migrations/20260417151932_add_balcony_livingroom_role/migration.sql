-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATOR');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'OPERATOR';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "balconies" INTEGER,
ADD COLUMN     "livingRooms" INTEGER;
