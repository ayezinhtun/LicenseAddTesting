CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();



-- Enable RLS
ALTER TABLE "public"."project_assigns" ENABLE ROW LEVEL SECURITY;

-- Correct policies
CREATE POLICY "project_assigns_select_authenticated" ON "public"."project_assigns" 
FOR SELECT TO "authenticated" 
USING (true);

CREATE POLICY "project_assigns_insert_authenticated" ON "public"."project_assigns" 
FOR INSERT TO "authenticated" 
WITH CHECK (true);

CREATE POLICY "project_assigns_update_authenticated" ON "public"."project_assigns" 
FOR UPDATE TO "authenticated" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "project_assigns_delete_authenticated" ON "public"."project_assigns" 
FOR DELETE TO "authenticated" 
USING (true);





-- Enable RLS for customers
ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

-- Add policies for customers
CREATE POLICY "customers_select_authenticated" ON "public"."customers" 
FOR SELECT TO "authenticated" 
USING (true);

CREATE POLICY "customers_insert_authenticated" ON "public"."customers" 
FOR INSERT TO "authenticated" 
WITH CHECK (true);

CREATE POLICY "customers_update_authenticated" ON "public"."customers" 
FOR UPDATE TO "authenticated" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "customers_delete_authenticated" ON "public"."customers" 
FOR DELETE TO "authenticated" 
USING (true);




-- Enable RLS for distributors
ALTER TABLE "public"."distributors" ENABLE ROW LEVEL SECURITY;

-- Add policies for distributors
CREATE POLICY "distributors_select_authenticated" ON "public"."distributors" 
FOR SELECT TO "authenticated" 
USING (true);

CREATE POLICY "distributors_insert_authenticated" ON "public"."distributors" 
FOR INSERT TO "authenticated" 
WITH CHECK (true);

CREATE POLICY "distributors_update_authenticated" ON "public"."distributors" 
FOR UPDATE TO "authenticated" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "distributors_delete_authenticated" ON "public"."distributors" 
FOR DELETE TO "authenticated" 
USING (true);


-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'license-attachments',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Add policy for attachments bucket
CREATE POLICY "Users can upload attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'attachments' AND 
  auth.role() = 'authenticated'
);
 
-- Add policy for attachments bucket
CREATE POLICY "Users can view attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'attachments' AND 
  auth.role() = 'authenticated'
);