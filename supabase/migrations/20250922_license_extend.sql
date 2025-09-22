-- Extend license schema: new status, child tables for serials/customers/distributors

-- 1) Extend license_status enum to add in_progress
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

-- 2) Per-serial table (one serial/contract + its own dates, qty, unit price, currency, po no)
create table if not exists license_serials (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  serial_or_contract text not null,
  start_date date not null,
  end_date date not null,
  qty integer not null default 1 check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  currency text not null default 'MMK', -- 'MMK' or 'USD'
  po_no text,
  created_at timestamptz default now()
);

create index if not exists idx_license_serials_license_id on license_serials(license_id);
alter table license_serials enable row level security;

create policy "auth can select license_serials" on license_serials for select to authenticated using (true);
create policy "auth can insert license_serials" on license_serials for insert to authenticated with check (true);
create policy "auth can update license_serials" on license_serials for update to authenticated using (true);
create policy "auth can delete license_serials" on license_serials for delete to authenticated using (true);

-- 3) Customers (optional multiple per license)
create table if not exists license_customers (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  company_name text not null,
  contact_person text,
  contact_email text,
  contact_number text,
  address text,
  created_at timestamptz default now()
);

create index if not exists idx_license_customers_license_id on license_customers(license_id);
alter table license_customers enable row level security;
create policy "auth can select license_customers" on license_customers for select to authenticated using (true);
create policy "auth can insert license_customers" on license_customers for insert to authenticated with check (true);
create policy "auth can update license_customers" on license_customers for update to authenticated using (true);
create policy "auth can delete license_customers" on license_customers for delete to authenticated using (true);

-- 4) Distributors (optional multiple per license)
create table if not exists license_distributors (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  company_name text not null,
  contact_person text,
  contact_email text,
  contact_number text,
  created_at timestamptz default now()
);

create index if not exists idx_license_distributors_license_id on license_distributors(license_id);
alter table license_distributors enable row level security;
create policy "auth can select license_distributors" on license_distributors for select to authenticated using (true);
create policy "auth can insert license_distributors" on license_distributors for insert to authenticated with check (true);
create policy "auth can update license_distributors" on license_distributors for update to authenticated using (true);
create policy "auth can delete license_distributors" on license_distributors for delete to authenticated using (true);
