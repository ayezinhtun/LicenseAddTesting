DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'license_status' AND e.enumlabel = 'in_progress'
  ) THEN
    ALTER TYPE license_status ADD VALUE 'in_progress';
  END IF;
END $$;

ALTER TABLE public.licenses
  DROP COLUMN IF EXISTS auto_renew,
  DROP COLUMN IF EXISTS url,
  DROP COLUMN IF EXISTS activation_link,
  DROP COLUMN IF EXISTS custom_fields,
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS license_cost,
  DROP COLUMN IF EXISTS quantity;

