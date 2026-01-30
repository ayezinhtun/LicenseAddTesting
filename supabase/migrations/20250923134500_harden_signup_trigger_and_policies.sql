
-- 1) Ensure RLS is enabled (no-op if already)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2) INSERT policies
-- Allow authenticated users to insert their own profile (if client ever does it directly)
DROP POLICY IF EXISTS user_profiles_insert_self ON public.user_profiles;
CREATE POLICY user_profiles_insert_self ON public.user_profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow service_role to insert freely (server-side)
DROP POLICY IF EXISTS user_profiles_insert_service_role ON public.user_profiles;
CREATE POLICY user_profiles_insert_service_role ON public.user_profiles
FOR INSERT TO service_role
WITH CHECK (true);

-- 3) Update trigger function to bypass RLS and be idempotent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user'::public.user_role,
    'pending'::public.user_status
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4) Ensure trigger exists and points to the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 5) Optional: backfill any users missing a profile (safe/idempotent)
INSERT INTO public.user_profiles (user_id, email, full_name, role, status)
SELECT u.id,
       u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', u.email),
       'user'::public.user_role,
       'pending'::public.user_status
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;
