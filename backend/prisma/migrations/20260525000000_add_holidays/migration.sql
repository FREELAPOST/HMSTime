CREATE TABLE "Holiday" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "note" VARCHAR(160),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
