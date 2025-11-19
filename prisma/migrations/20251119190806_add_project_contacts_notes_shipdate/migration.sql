-- AlterTable
ALTER TABLE "Projects" ADD COLUMN     "primaryContactId" INTEGER,
ADD COLUMN     "shipDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProjectContacts" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "contactType" TEXT NOT NULL,
    "companyName" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectNotes" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectNotes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContacts" ADD CONSTRAINT "ProjectContacts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNotes" ADD CONSTRAINT "ProjectNotes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
