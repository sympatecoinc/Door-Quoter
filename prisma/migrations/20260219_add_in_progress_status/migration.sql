-- Add 'In Progress' value to ProjectStatus enum
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'In Progress' AFTER 'Active';

-- Data migration: move deprecated statuses to new workflow statuses
-- CONTACTED → NEW_LEAD (contacted is no longer a separate status)
UPDATE "Projects" SET "status" = 'New Lead' WHERE "status" = 'Contacted';
UPDATE "ProjectStatusHistory" SET "status" = 'New Lead' WHERE "status" = 'Contacted';

-- APPROVED → STAGING (approved is replaced by the preparing quote stage)
UPDATE "Projects" SET "status" = 'Staging' WHERE "status" = 'Approved';
UPDATE "ProjectStatusHistory" SET "status" = 'Staging' WHERE "status" = 'Approved';

-- REVISE → STAGING (revise is no longer a status, revisions use the revision endpoint)
UPDATE "Projects" SET "status" = 'Staging' WHERE "status" = 'Revise';
UPDATE "ProjectStatusHistory" SET "status" = 'Staging' WHERE "status" = 'Revise';
