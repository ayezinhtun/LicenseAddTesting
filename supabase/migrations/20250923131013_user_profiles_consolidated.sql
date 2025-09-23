-- Consolidated migration: ensure user_profiles table, status enum, helper triggers, and signup trigger exist

-- 0) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('user','admin','super_user');
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'super_user'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'super_user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE public.user_status AS ENUM ('pending','approved','rejected');
  END IF;
END $$;

-- 1) Function to maintain updated_at
CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- 2) user_profiles table (matches your schema; timestamptz)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  role public.user_role NULL DEFAULT 'user'::user_role,
  department text NULL DEFAULT 'General'::text,
  phone text NULL,
  avatar_url text NULL,
  is_active boolean NULL DEFAULT true,
  permissions jsonb NULL DEFAULT '{}'::jsonb,
  preferences jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  last_login timestamptz NULL,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_email_key UNIQUE (email),
  CONSTRAINT user_profiles_user_id_key UNIQUE (user_id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 3) Add status (pending/approved/rejected) used by the app (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles' AND column_name='status'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN status public.user_status NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_department ON public.user_profiles USING btree (department) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles USING btree (role) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles USING btree (user_id) TABLESPACE pg_default;

-- 5) Trigger to update updated_at (drop if exists then recreate)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'update_user_profiles_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'user_profiles'
  ) THEN
    DROP TRIGGER update_user_profiles_updated_at ON public.user_profiles;
  END IF;
END $$;

CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_profile_updated_at();

-- 6) Trigger on auth.users to auto-create a profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_profiles (user_id, email, full_name, role, status)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'user'::public.user_role, 'pending'::public.user_status);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    DROP TRIGGER on_auth_user_created ON auth.users;
  END IF;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
