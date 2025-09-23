-- User Management Setup: roles, status, project assignments, triggers, and RLS policies

-- 1) Ensure enums exist/are updated
DO $$
BEGIN
  -- user_role enum may already exist; add 'super_user' if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'super_user');
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'super_user'
    ) THEN
      ALTER TYPE public.user_role ADD VALUE 'super_user';
    END IF;
  END IF;

  -- user_status enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE public.user_status AS ENUM ('pending','approved','rejected');
  END IF;
END $$;


-- 2) Ensure user_profiles table exists and has required columns
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
  department text NULL DEFAULT 'General',
  phone text NULL,
  avatar_url text NULL,
  is_active boolean NULL DEFAULT true,
  permissions jsonb NULL DEFAULT '{}'::jsonb,
  preferences jsonb NULL DEFAULT '{}'::jsonb,
  status public.user_status NOT NULL DEFAULT 'pending'::public.user_status,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  last_login timestamptz NULL
);

-- Safe add columns if they didn't exist previously
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles' AND column_name='status'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN status public.user_status NOT NULL DEFAULT 'pending'::public.user_status;
  END IF;
END $$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_profile_updated_at();


-- 3) Create mapping table for project assignments (multiple per user)
CREATE TABLE IF NOT EXISTS public.user_project_assigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_assign text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_project_assigns_project_check CHECK (project_assign IN ('NPT','YGN','MPT')),
  CONSTRAINT user_project_assigns_user_project_unique UNIQUE (user_id, project_assign)
);

CREATE INDEX IF NOT EXISTS idx_user_project_assigns_user ON public.user_project_assigns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_assigns_assign ON public.user_project_assigns(project_assign);


-- 4) On new auth.users row, create default user_profiles row (role=user, status=pending)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_profiles (user_id, email, full_name, role, status)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'user'::public.user_role, 'pending'::public.user_status);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- 5) RLS policies
-- user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read profiles (needed for UI)
DROP POLICY IF EXISTS user_profiles_read_all ON public.user_profiles;
CREATE POLICY user_profiles_read_all ON public.user_profiles
FOR SELECT TO authenticated USING (true);

-- Only admins can update profiles (role/status/assignments management via UI)
DROP POLICY IF EXISTS user_profiles_update_admin ON public.user_profiles;
CREATE POLICY user_profiles_update_admin ON public.user_profiles
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  )
);

-- user_project_assigns
ALTER TABLE public.user_project_assigns ENABLE ROW LEVEL SECURITY;

-- Admins can manage assignments
DROP POLICY IF EXISTS user_project_assigns_admin_all ON public.user_project_assigns;
CREATE POLICY user_project_assigns_admin_all ON public.user_project_assigns
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  )
);

-- Non-admins can read their own assignments
DROP POLICY IF EXISTS user_project_assigns_self_read ON public.user_project_assigns;
CREATE POLICY user_project_assigns_self_read ON public.user_project_assigns
FOR SELECT TO authenticated
USING (user_id = auth.uid());


-- 6) Licenses RLS: restrict data by project_assign
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Admins: full access
DROP POLICY IF EXISTS licenses_admin_all ON public.licenses;
CREATE POLICY licenses_admin_all ON public.licenses
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'::public.user_role
  )
);

-- Super users: can select/insert/update only where license.project_assign is in their assigned set; cannot delete
DROP POLICY IF EXISTS licenses_super_user_read_write ON public.licenses;
CREATE POLICY licenses_super_user_read_write ON public.licenses
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'super_user'::public.user_role
  )
  AND (
    project_assign IS NULL OR project_assign IN (
      SELECT upa.project_assign FROM public.user_project_assigns upa WHERE upa.user_id = auth.uid()
    )
  )
);

CREATE POLICY licenses_super_user_insert ON public.licenses
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_user'::public.user_role
  )
  AND (
    project_assign IS NULL OR project_assign IN (
      SELECT upa.project_assign FROM public.user_project_assigns upa WHERE upa.user_id = auth.uid()
    )
  )
);

CREATE POLICY licenses_super_user_update ON public.licenses
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_user'::public.user_role
  )
  AND (
    project_assign IS NULL OR project_assign IN (
      SELECT upa.project_assign FROM public.user_project_assigns upa WHERE upa.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_user'::public.user_role
  )
  AND (
    project_assign IS NULL OR project_assign IN (
      SELECT upa.project_assign FROM public.user_project_assigns upa WHERE upa.user_id = auth.uid()
    )
  )
);

-- Users: read-only, restricted by their assignment; no write
DROP POLICY IF EXISTS licenses_user_select ON public.licenses;
CREATE POLICY licenses_user_select ON public.licenses
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'user'::public.user_role
  )
  AND (
    project_assign IS NULL OR project_assign IN (
      SELECT upa.project_assign FROM public.user_project_assigns upa WHERE upa.user_id = auth.uid()
    )
  )
);

-- Explicitly prevent delete for non-admins (no delete policies provided for those roles)

-- 7) Helpful views (optional): list users with aggregated assignments
CREATE OR REPLACE VIEW public.v_users_with_assigns AS
SELECT
  up.id,
  up.user_id,
  up.email,
  up.full_name,
  up.role,
  up.status,
  ARRAY_AGG(upa.project_assign ORDER BY upa.project_assign) FILTER (WHERE upa.project_assign IS NOT NULL) AS assignments,
  up.created_at,
  up.updated_at
FROM public.user_profiles up
LEFT JOIN public.user_project_assigns upa ON upa.user_id = up.user_id
GROUP BY up.id, up.user_id, up.email, up.full_name, up.role, up.status, up.created_at, up.updated_at;
