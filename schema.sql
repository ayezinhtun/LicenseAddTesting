


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."audit_action" AS ENUM (
    'create',
    'update',
    'delete',
    'view',
    'export',
    'login',
    'logout'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."entity_type" AS ENUM (
    'license',
    'user',
    'report',
    'notification',
    'notifications',
    'license_comments',
    'license_attachments',
    'user_profiles',
    'license_serials',
    'license_customers',
    'license_distributors',
    'user_project_assigns',
    'licenses',
    'vendors',
    'project_assigns',
    'customers',
    'distributors',
    'renewal_history'
);


ALTER TYPE "public"."entity_type" OWNER TO "postgres";


CREATE TYPE "public"."license_status" AS ENUM (
    'active',
    'expired',
    'suspended',
    'pending',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."license_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_priority" AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE "public"."notification_priority" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'expiry',
    'renewal',
    'comment',
    'system',
    'warning',
    'info'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."priority_level" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."priority_level" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'admin',
    'manager',
    'super_user'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_log_row"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_action public.audit_action;
  v_entity_type public.entity_type;
  v_entity_id text := null;
  v_user jsonb := '{}'::jsonb;
  v_client jsonb := '{}'::jsonb;
  v_user_id text := '';
  v_user_name text := '';
  v_ip text := null;
  v_ua text := null;
  v_changes jsonb := '{}'::jsonb;
  v_new jsonb := null;
  v_old jsonb := null;
begin
  if TG_OP = 'INSERT' then
    v_action := 'create';
    v_new := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_old := to_jsonb(OLD);
  else
    return null;
  end if;

  v_entity_type := TG_TABLE_NAME::public.entity_type;

  if TG_OP in ('INSERT','UPDATE') then
    begin v_entity_id := NEW.id::text; exception when others then v_entity_id := null; end;
  else
    begin v_entity_id := OLD.id::text; exception when others then v_entity_id := null; end;
  end if;
  if v_entity_id is null then
    if v_new is not null then
      v_entity_id := md5(v_new::text);
    else
      v_entity_id := md5(v_old::text);
    end if;
  end if;

  if TG_OP = 'INSERT' then
    v_changes := jsonb_build_object('new', v_new);
  elsif TG_OP = 'DELETE' then
    v_changes := jsonb_build_object('old', v_old);
  else
    v_changes := public.jsonb_changes(v_old, v_new);
  end if;

  v_user := public.current_request_user();
  v_client := public.current_request_client();
  v_user_id := coalesce(v_user->>'user_id', '');
  v_user_name := coalesce(v_user->>'user_name', '');
  v_ip := nullif(v_client->>'ip', '');
  v_ua := nullif(v_client->>'ua', '');

  insert into public.audit_logs(
    action, entity_type, entity_id, user_id, user_name, changes, ip_address, user_agent
  ) values (
    v_action, v_entity_type, v_entity_id, v_user_id, v_user_name, v_changes, v_ip, v_ua
  );

  if TG_OP in ('INSERT','UPDATE') then
    return NEW;
  else
    return OLD;
  end if;
end
$$;


ALTER FUNCTION "public"."audit_log_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_notification_reads"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM notification_reads WHERE notification_id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cleanup_notification_reads"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_request_client"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_headers jsonb := '{}'::jsonb;
  v_client jsonb := '{}'::jsonb;
begin
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_client := jsonb_build_object(
    'ip', coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''),
    'ua', coalesce(v_headers->>'user-agent', '')
  );
  return v_client;
end
$$;


ALTER FUNCTION "public"."current_request_client"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_request_user"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_claims jsonb := '{}'::jsonb;
  v_user jsonb := '{}'::jsonb;
begin
  begin
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  v_user := jsonb_build_object(
    'user_id', coalesce(v_claims->>'sub', ''),
    'user_name', coalesce(v_claims->>'email', v_claims->>'name', '')
  );
  return v_user;
end
$$;


ALTER FUNCTION "public"."current_request_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jsonb_changes"("old_row" "jsonb", "new_row" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql"
    AS $$
  with keys as (
    select distinct key from jsonb_each(coalesce(old_row, '{}'::jsonb))
    union
    select distinct key from jsonb_each(coalesce(new_row, '{}'::jsonb))
  ),
  diff as (
    select
      k.key,
      old_row -> k.key as old_val,
      new_row -> k.key as new_val
    from keys k
  )
  select coalesce(
    jsonb_object_agg(d.key, jsonb_build_object('old', d.old_val, 'new', d.new_val))
      filter (where d.old_val is distinct from d.new_val),
    '{}'::jsonb
  )
  from diff d;
$$;


ALTER FUNCTION "public"."jsonb_changes"("old_row" "jsonb", "new_row" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."update_user_profile_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "public"."audit_action" NOT NULL,
    "entity_type" "public"."entity_type" NOT NULL,
    "entity_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_person" "text",
    "contact_email" "text",
    "contact_number" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."distributors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_person" "text",
    "contact_email" "text",
    "contact_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."distributors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."license_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "license_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "file_url" "text" NOT NULL,
    "uploaded_by" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "description" "text"
);


ALTER TABLE "public"."license_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."license_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "license_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "text" NOT NULL,
    "author_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_edited" boolean DEFAULT false NOT NULL,
    "edited_at" timestamp with time zone,
    "mentions" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."license_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."license_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "license_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_person" "text",
    "contact_email" "text",
    "contact_number" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "customer_id" "uuid"
);


ALTER TABLE "public"."license_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."license_distributors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "license_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_person" "text",
    "contact_email" "text",
    "contact_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "distributor_id" "uuid"
);


ALTER TABLE "public"."license_distributors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."license_serials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "license_id" "uuid" NOT NULL,
    "serial_or_contract" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "qty" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'MMK'::"text" NOT NULL,
    "po_no" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notify_before_days" integer,
    "last_notified_on" "date",
    "renewal" boolean DEFAULT false NOT NULL,
    CONSTRAINT "license_serials_qty_check" CHECK (("qty" > 0))
);


ALTER TABLE "public"."license_serials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."licenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor" "text" NOT NULL,
    "item_description" "text" NOT NULL,
    "project_name" "text" NOT NULL,
    "license_start_date" "date",
    "license_end_date" "date",
    "remark" "text",
    "priority" "public"."priority_level" DEFAULT 'medium'::"public"."priority_level" NOT NULL,
    "status" "public"."license_status" DEFAULT 'active'::"public"."license_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text" NOT NULL,
    "last_modified_by" "text" NOT NULL,
    "user_id" "uuid",
    "project_assign" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "licenses_status_check" CHECK (("status" = ANY (ARRAY['active'::"public"."license_status", 'expired'::"public"."license_status", 'suspended'::"public"."license_status", 'pending'::"public"."license_status", 'in_progress'::"public"."license_status", 'completed'::"public"."license_status"])))
);


ALTER TABLE "public"."licenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_deletions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_deletions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "license_id" "uuid",
    "user_id" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "priority" "public"."notification_priority" DEFAULT 'medium'::"public"."notification_priority" NOT NULL,
    "action_required" boolean DEFAULT false NOT NULL,
    "action_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "serial_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_assigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_assigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."renewal_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "license_id" "uuid" NOT NULL,
    "renewal_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "previous_end_date" "date" NOT NULL,
    "cost" numeric(12,2) NOT NULL,
    "renewed_by" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "prev_product_name" "text",
    "prev_remark" "text",
    "prev_serial_no" "text",
    "prev_serial_start_date" "date",
    "prev_serial_end_date" "date",
    "prev_selected_serial_id" "uuid"
);


ALTER TABLE "public"."renewal_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role",
    "department" "text" DEFAULT 'General'::"text",
    "phone" "text",
    "avatar_url" "text",
    "is_active" boolean DEFAULT true,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_login" timestamp with time zone,
    "status" "public"."user_status" DEFAULT 'pending'::"public"."user_status" NOT NULL,
    CONSTRAINT "user_profiles_role_no_manager" CHECK ((("role")::"text" <> 'manager'::"text"))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_project_assigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_assign" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_project_assigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."distributors"
    ADD CONSTRAINT "distributors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_attachments"
    ADD CONSTRAINT "license_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_comments"
    ADD CONSTRAINT "license_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_customers"
    ADD CONSTRAINT "license_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_distributors"
    ADD CONSTRAINT "license_distributors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_serials"
    ADD CONSTRAINT "license_serials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."license_serials"
    ADD CONSTRAINT "license_serials_serial_or_contract_key" UNIQUE ("serial_or_contract");



ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_deletions"
    ADD CONSTRAINT "notification_deletions_notification_id_user_id_key" UNIQUE ("notification_id", "user_id");



ALTER TABLE ONLY "public"."notification_deletions"
    ADD CONSTRAINT "notification_deletions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_notification_id_user_id_key" UNIQUE ("notification_id", "user_id");



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_assigns"
    ADD CONSTRAINT "project_assigns_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."project_assigns"
    ADD CONSTRAINT "project_assigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."renewal_history"
    ADD CONSTRAINT "renewal_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_project_assigns"
    ADD CONSTRAINT "user_project_assigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_project_assigns"
    ADD CONSTRAINT "user_project_assigns_user_project_unique" UNIQUE ("user_id", "project_assign");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_entity_type" ON "public"."audit_logs" USING "btree" ("entity_type");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_customers_company_name" ON "public"."customers" USING "btree" ("company_name");



CREATE INDEX "idx_distributors_company_name" ON "public"."distributors" USING "btree" ("company_name");



CREATE INDEX "idx_license_attachments_license_id" ON "public"."license_attachments" USING "btree" ("license_id");



CREATE INDEX "idx_license_comments_license_id" ON "public"."license_comments" USING "btree" ("license_id");



CREATE INDEX "idx_license_customers_license_id" ON "public"."license_customers" USING "btree" ("license_id");



CREATE INDEX "idx_license_distributors_license_id" ON "public"."license_distributors" USING "btree" ("license_id");



CREATE INDEX "idx_license_serials_end_date" ON "public"."license_serials" USING "btree" ("end_date");



CREATE INDEX "idx_license_serials_license_id" ON "public"."license_serials" USING "btree" ("license_id");



CREATE INDEX "idx_licenses_created_at" ON "public"."licenses" USING "btree" ("created_at");



CREATE INDEX "idx_licenses_end_date" ON "public"."licenses" USING "btree" ("license_end_date");



CREATE INDEX "idx_licenses_priority" ON "public"."licenses" USING "btree" ("priority");



CREATE INDEX "idx_licenses_project_assign" ON "public"."licenses" USING "btree" ("project_assign");



CREATE INDEX "idx_licenses_project_name" ON "public"."licenses" USING "btree" ("project_name");



CREATE INDEX "idx_licenses_status" ON "public"."licenses" USING "btree" ("status");



CREATE INDEX "idx_licenses_vendor" ON "public"."licenses" USING "btree" ("vendor");



CREATE INDEX "idx_notification_deletions_notification_id" ON "public"."notification_deletions" USING "btree" ("notification_id");



CREATE INDEX "idx_notification_deletions_user_id" ON "public"."notification_deletions" USING "btree" ("user_id");



CREATE INDEX "idx_notification_reads_notification_id" ON "public"."notification_reads" USING "btree" ("notification_id");



CREATE INDEX "idx_notification_reads_user_id" ON "public"."notification_reads" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_project_assigns_name" ON "public"."project_assigns" USING "btree" ("name");



CREATE INDEX "idx_renewal_history_license_id" ON "public"."renewal_history" USING "btree" ("license_id");



CREATE INDEX "idx_renewal_history_prev_selected_serial_id" ON "public"."renewal_history" USING "btree" ("prev_selected_serial_id");



CREATE INDEX "idx_user_profiles_department" ON "public"."user_profiles" USING "btree" ("department");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_user_project_assigns_assign" ON "public"."user_project_assigns" USING "btree" ("project_assign");



CREATE INDEX "idx_user_project_assigns_user" ON "public"."user_project_assigns" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_audit_customers" AFTER INSERT OR DELETE OR UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_distributors" AFTER INSERT OR DELETE OR UPDATE ON "public"."distributors" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_license_attachments" AFTER INSERT OR DELETE OR UPDATE ON "public"."license_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_license_comments" AFTER INSERT OR DELETE OR UPDATE ON "public"."license_comments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_license_customers" AFTER INSERT OR DELETE OR UPDATE ON "public"."license_customers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_license_distributors" AFTER INSERT OR DELETE OR UPDATE ON "public"."license_distributors" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_license_serials" AFTER INSERT OR DELETE OR UPDATE ON "public"."license_serials" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_licenses" AFTER INSERT OR DELETE OR UPDATE ON "public"."licenses" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_notifications" AFTER INSERT OR DELETE OR UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_project_assigns" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_assigns" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_renewal_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."renewal_history" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_user_profiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_user_project_assigns" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_project_assigns" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_audit_vendors" AFTER INSERT OR DELETE OR UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_row"();



CREATE OR REPLACE TRIGGER "trg_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_distributors_updated_at" BEFORE UPDATE ON "public"."distributors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vendors_updated_at" BEFORE UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_cleanup_notification_reads" AFTER DELETE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_notification_reads"();



CREATE OR REPLACE TRIGGER "update_licenses_updated_at" BEFORE UPDATE ON "public"."licenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profile_updated_at"();



ALTER TABLE ONLY "public"."license_attachments"
    ADD CONSTRAINT "license_attachments_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."license_comments"
    ADD CONSTRAINT "license_comments_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."license_customers"
    ADD CONSTRAINT "license_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."license_customers"
    ADD CONSTRAINT "license_customers_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."license_distributors"
    ADD CONSTRAINT "license_distributors_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."license_distributors"
    ADD CONSTRAINT "license_distributors_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."license_serials"
    ADD CONSTRAINT "license_serials_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_project_assign_fk" FOREIGN KEY ("project_assign") REFERENCES "public"."project_assigns"("name") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_vendor_name_fkey" FOREIGN KEY ("vendor") REFERENCES "public"."vendors"("name") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notification_deletions"
    ADD CONSTRAINT "notification_deletions_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_deletions"
    ADD CONSTRAINT "notification_deletions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "public"."license_serials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."renewal_history"
    ADD CONSTRAINT "renewal_history_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."renewal_history"
    ADD CONSTRAINT "renewal_history_prev_selected_serial_id_fkey" FOREIGN KEY ("prev_selected_serial_id") REFERENCES "public"."license_serials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_project_assigns"
    ADD CONSTRAINT "user_project_assigns_project_fk" FOREIGN KEY ("project_assign") REFERENCES "public"."project_assigns"("name") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_project_assigns"
    ADD CONSTRAINT "user_project_assigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow Edge Functions to read license_serials" ON "public"."license_serials" FOR SELECT USING (("auth"."role"() = ANY (ARRAY['service_role'::"text", 'anon'::"text"])));



CREATE POLICY "Allow Edge Functions to read licenses" ON "public"."licenses" FOR SELECT USING (("auth"."role"() = ANY (ARRAY['service_role'::"text", 'anon'::"text"])));



CREATE POLICY "Allow authenticated users to insert audit logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read for authenticated" ON "public"."vendors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow write for authenticated" ON "public"."vendors" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Insert own profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Select own profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete audit logs" ON "public"."audit_logs" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete license attachments" ON "public"."license_attachments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete licenses" ON "public"."licenses" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete their notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can insert license attachments" ON "public"."license_attachments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert license comments" ON "public"."license_comments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert licenses" ON "public"."licenses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert renewal history" ON "public"."renewal_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can update licenses" ON "public"."licenses" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update their comments" ON "public"."license_comments" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update their notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view all licenses" ON "public"."licenses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view license attachments" ON "public"."license_attachments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view license comments" ON "public"."license_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view renewal history" ON "public"."renewal_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth can delete license_customers" ON "public"."license_customers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "auth can delete license_distributors" ON "public"."license_distributors" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "auth can delete license_serials" ON "public"."license_serials" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "auth can insert license_customers" ON "public"."license_customers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth can insert license_distributors" ON "public"."license_distributors" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth can insert license_serials" ON "public"."license_serials" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth can select license_customers" ON "public"."license_customers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth can select license_distributors" ON "public"."license_distributors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth can select license_serials" ON "public"."license_serials" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth can update license_customers" ON "public"."license_customers" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "auth can update license_distributors" ON "public"."license_distributors" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "auth can update license_serials" ON "public"."license_serials" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."license_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."license_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."license_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."license_distributors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."license_serials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."licenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_delete_admin" ON "public"."user_profiles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "user_profiles_insert_self" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_profiles_insert_service_role" ON "public"."user_profiles" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "user_profiles_read_all" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_profiles_update_admin" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



ALTER TABLE "public"."user_project_assigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_project_assigns_admin_all" ON "public"."user_project_assigns" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "user_project_assigns_self_read" ON "public"."user_project_assigns" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."audit_log_row"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_log_row"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_row"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_notification_reads"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_notification_reads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_notification_reads"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_request_client"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_request_client"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_request_client"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_request_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_request_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_request_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb_changes"("old_row" "jsonb", "new_row" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb_changes"("old_row" "jsonb", "new_row" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb_changes"("old_row" "jsonb", "new_row" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."distributors" TO "anon";
GRANT ALL ON TABLE "public"."distributors" TO "authenticated";
GRANT ALL ON TABLE "public"."distributors" TO "service_role";



GRANT ALL ON TABLE "public"."license_attachments" TO "anon";
GRANT ALL ON TABLE "public"."license_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."license_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."license_comments" TO "anon";
GRANT ALL ON TABLE "public"."license_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."license_comments" TO "service_role";



GRANT ALL ON TABLE "public"."license_customers" TO "anon";
GRANT ALL ON TABLE "public"."license_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."license_customers" TO "service_role";



GRANT ALL ON TABLE "public"."license_distributors" TO "anon";
GRANT ALL ON TABLE "public"."license_distributors" TO "authenticated";
GRANT ALL ON TABLE "public"."license_distributors" TO "service_role";



GRANT ALL ON TABLE "public"."license_serials" TO "anon";
GRANT ALL ON TABLE "public"."license_serials" TO "authenticated";
GRANT ALL ON TABLE "public"."license_serials" TO "service_role";



GRANT ALL ON TABLE "public"."licenses" TO "anon";
GRANT ALL ON TABLE "public"."licenses" TO "authenticated";
GRANT ALL ON TABLE "public"."licenses" TO "service_role";



GRANT ALL ON TABLE "public"."notification_deletions" TO "anon";
GRANT ALL ON TABLE "public"."notification_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."notification_reads" TO "anon";
GRANT ALL ON TABLE "public"."notification_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_reads" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."project_assigns" TO "anon";
GRANT ALL ON TABLE "public"."project_assigns" TO "authenticated";
GRANT ALL ON TABLE "public"."project_assigns" TO "service_role";



GRANT ALL ON TABLE "public"."renewal_history" TO "anon";
GRANT ALL ON TABLE "public"."renewal_history" TO "authenticated";
GRANT ALL ON TABLE "public"."renewal_history" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_project_assigns" TO "anon";
GRANT ALL ON TABLE "public"."user_project_assigns" TO "authenticated";
GRANT ALL ON TABLE "public"."user_project_assigns" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































