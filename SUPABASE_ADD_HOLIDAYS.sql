CREATE TABLE IF NOT EXISTS "Holiday" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "note" VARCHAR(160),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX IF NOT EXISTS "Holiday_date_idx" ON "Holiday"("date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Holiday_createdById_fkey'
      AND table_name = 'Holiday'
  ) THEN
    ALTER TABLE "Holiday"
      ADD CONSTRAINT "Holiday_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
