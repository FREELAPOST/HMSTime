CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');
CREATE TYPE "WorkSchedule" AS ENUM ('MON_FRI', 'MON_SAT', 'MON_SUN');
CREATE TYPE "EntryType" AS ENUM ('IN', 'OUT');
CREATE TYPE "EntryStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');
CREATE TYPE "EntrySource" AS ENUM ('AUTO', 'MANUAL_ADMIN', 'MANUAL_EMPLOYEE', 'ADJUSTMENT');
CREATE TYPE "AdjustmentKind" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE "AdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "code" CHAR(6) NOT NULL,
  "name" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "pinHash" TEXT NOT NULL,
  "dailyMinutesExpected" INTEGER NOT NULL,
  "workSchedule" "WorkSchedule" NOT NULL DEFAULT 'MON_FRI',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "deactivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "EntryType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" "EntryStatus" NOT NULL DEFAULT 'APPROVED',
  "source" "EntrySource" NOT NULL DEFAULT 'AUTO',
  "reason" VARCHAR(50),
  "isEdited" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeAdjustmentRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AdjustmentKind" NOT NULL,
  "entryId" TEXT,
  "requestedType" "EntryType",
  "requestedOccurredAt" TIMESTAMP(3),
  "originalSnapshot" JSONB,
  "proposedSnapshot" JSONB,
  "reason" VARCHAR(50) NOT NULL,
  "status" "AdjustmentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimeAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "targetUserId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanySettings" (
  "id" TEXT NOT NULL DEFAULT 'company',
  "legalName" TEXT NOT NULL DEFAULT '',
  "cnpj" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "logoPath" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Checkpoint" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "reason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "User_code_key" ON "User"("code");
CREATE INDEX "TimeEntry_userId_occurredAt_idx" ON "TimeEntry"("userId", "occurredAt");
CREATE INDEX "TimeAdjustmentRequest_userId_status_idx" ON "TimeAdjustmentRequest"("userId", "status");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeAdjustmentRequest" ADD CONSTRAINT "TimeAdjustmentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeAdjustmentRequest" ADD CONSTRAINT "TimeAdjustmentRequest_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TimeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeAdjustmentRequest" ADD CONSTRAINT "TimeAdjustmentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
