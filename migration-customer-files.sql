-- Create CustomerFiles table
CREATE TABLE IF NOT EXISTS "CustomerFiles" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFiles_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "CustomerFiles" ADD CONSTRAINT "CustomerFiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;