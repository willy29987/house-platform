-- CreateTable
CREATE TABLE "AdminCloudData" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCloudData_pkey" PRIMARY KEY ("key")
);
