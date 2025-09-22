-- 1. Create ENUM type for user roles

DO $$

BEGIN

IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN

CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'manager');

END IF;

END$$;

  

-- 2. Create trigger function to update updated_at

CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()

RETURNS TRIGGER AS $$

BEGIN

NEW.updated_at = NOW();

RETURN NEW;

END;

$$ LANGUAGE plpgsql;

  

-- 3. Create table if not exists

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

  

-- 4. Create indexes

CREATE INDEX IF NOT EXISTS idx_user_profiles_department ON public.user_profiles USING btree (department) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles USING btree (role) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles USING btree (user_id) TABLESPACE pg_default;

  

-- 5. Create trigger safely

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

  

CREATE TRIGGER update_user_profiles_updated_at

BEFORE UPDATE ON public.user_profiles

FOR EACH ROW

EXECUTE FUNCTION public.update_user_profile_updated_at();


