-- Add field verification token to Projects
ALTER TABLE "Projects" ADD COLUMN IF NOT EXISTS "fieldVerificationToken" TEXT;

-- Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Projects_fieldVerificationToken_key'
    ) THEN
        ALTER TABLE "Projects" ADD CONSTRAINT "Projects_fieldVerificationToken_key" UNIQUE ("fieldVerificationToken");
    END IF;
END $$;

-- Generate UUIDs for existing projects that don't have a field verification token
UPDATE "Projects" SET "fieldVerificationToken" = gen_random_uuid()::text WHERE "fieldVerificationToken" IS NULL;

-- Create FieldVerificationUploads table
CREATE TABLE IF NOT EXISTS "FieldVerificationUploads" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "gcsPath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "FieldVerificationUploads_pkey" PRIMARY KEY ("id")
);

-- Create index on projectId
CREATE INDEX IF NOT EXISTS "FieldVerificationUploads_projectId_idx" ON "FieldVerificationUploads"("projectId");

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FieldVerificationUploads_projectId_fkey'
    ) THEN
        ALTER TABLE "FieldVerificationUploads" ADD CONSTRAINT "FieldVerificationUploads_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
