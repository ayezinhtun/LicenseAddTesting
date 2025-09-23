-- Migration: add project_assign and remove project_name restriction
-- Purpose: Keep free-text project_name and enforce allowed values on project_assign (NPT, YGN, MPT)

-- 1) Drop the old project_name CHECK constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'licenses'
      AND c.conname = 'licenses_project_name_allowed_check'
  ) THEN
    ALTER TABLE public.licenses DROP CONSTRAINT licenses_project_name_allowed_check;
  END IF;
END $$;

-- 2) Add project_assign column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'licenses'
      AND column_name = 'project_assign'
  ) THEN
    ALTER TABLE public.licenses
    ADD COLUMN project_assign text;
  END IF;
END $$;

-- 3) Add CHECK constraint for project_assign (allow NULL for legacy rows) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'licenses'
      AND c.conname = 'licenses_project_assign_allowed_check'
  ) THEN
    ALTER TABLE public.licenses
    ADD CONSTRAINT licenses_project_assign_allowed_check
    CHECK (project_assign IS NULL OR project_assign IN ('NPT','YGN','MPT')) NOT VALID;
  END IF;
END $$;

-- 4) Optional index to accelerate filtering by project_assign
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'idx_licenses_project_assign'
  ) THEN
    CREATE INDEX idx_licenses_project_assign 
      ON public.licenses USING btree (project_assign);
  END IF;
END $$;
