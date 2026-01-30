-- Add MILLING stage to WorkOrderStage enum between CUTTING and ASSEMBLY
ALTER TYPE "WorkOrderStage" ADD VALUE 'MILLING' AFTER 'CUTTING';
