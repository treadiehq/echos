-- Migration: Add unique constraint for organization names
-- This ensures that organization names are unique (case-insensitive)
-- and prevents duplicate organization names

-- Create a unique index on the lowercase version of the name
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_unique_name 
  ON organizations(LOWER(name));

