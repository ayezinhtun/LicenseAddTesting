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


-- to do vendor name to connect with license

begin;
insert into public.vendors (name)
select distinct l.vendor
from public.licenses l
left join public.vendors v on v.name = l.vendor
where l.vendor is not null
  and v.id is null;

-- 2) Add the FK to vendors.name
alter table public.licenses
  add constraint licenses_vendor_name_fkey
  foreign key (vendor)
  references public.vendors (name)
  on update cascade
  on delete restrict;

commit;


-- to do project_assign name to connect with license

begin;

-- 0) Seed any missing project_assign names from licenses
insert into public.project_assigns (name)
select distinct l.project_assign
from public.licenses l
left join public.project_assigns p on p.name = l.project_assign
where l.project_assign is not null
  and p.id is null;

-- 1) Replace the FK to use ON DELETE RESTRICT
alter table public.licenses
  drop constraint if exists licenses_project_assign_fk;

alter table public.licenses
  add constraint licenses_project_assign_fk
  foreign key (project_assign)
  references public.project_assigns (name)
  on update cascade
  on delete restrict;

commit;


-- to connect the project_assign to the user project_assign

begin;

-- 0) Seed any missing project_assign names from user_project_assigns
insert into public.project_assigns (name)
select distinct upa.project_assign
from public.user_project_assigns upa
left join public.project_assigns p on p.name = upa.project_assign
where upa.project_assign is not null
  and p.id is null;

-- 1) Replace the FK to use ON DELETE RESTRICT
alter table public.user_project_assigns
  drop constraint if exists user_project_assigns_project_fk;

alter table public.user_project_assigns
  add constraint user_project_assigns_project_fk
  foreign key (project_assign)
  references public.project_assigns (name)
  on update cascade
  on delete restrict;

commit;