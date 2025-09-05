-- Safe enum update migration
-- First, add the new 'active' value to the existing enum
ALTER TYPE "public"."volunteer_status" ADD VALUE 'active';
-- Then, add the new 'inactive' value to the existing enum
ALTER TYPE "public"."volunteer_status" ADD VALUE 'inactive';

-- Update any 'full' status volunteers to 'active' (if any exist)
UPDATE "volunteers" SET "status" = 'active' WHERE "status" = 'full';

-- Note: We cannot remove 'full' from the enum without recreating it
-- But the application code now uses 'active' instead of 'full'
-- This approach is safer and avoids the drizzle-kit enum modification bug
