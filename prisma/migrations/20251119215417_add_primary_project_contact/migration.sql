-- AlterTable
ALTER TABLE "Projects" ADD COLUMN     "primaryProjectContactId" INTEGER;

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_primaryProjectContactId_fkey" FOREIGN KEY ("primaryProjectContactId") REFERENCES "ProjectContacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
