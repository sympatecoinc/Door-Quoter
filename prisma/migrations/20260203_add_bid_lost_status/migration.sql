-- Add BID_LOST value to ProjectStatus enum
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'Bid Lost';
