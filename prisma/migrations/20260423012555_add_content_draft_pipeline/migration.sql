-- CreateEnum
CREATE TYPE "ContentDraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ContentChannel" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'THREADS', 'XIAOHONGSHU', 'YOUTUBE_SHORTS', 'LINE_OA');

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL DEFAULT '',
    "script" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT[],
    "algorithmNotes" JSONB,
    "sourceType" TEXT NOT NULL DEFAULT 'AI_TEAM',
    "sourceUrl" TEXT,
    "targetChannels" "ContentChannel"[],
    "status" "ContentDraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentDraft_status_createdAt_idx" ON "ContentDraft"("status", "createdAt");
