-- Track if a serial has been renewed (stop notifications when true)
alter table public.license_serials
add column if not exists renewal boolean not null default false;

-- Track daily notification throttle
alter table public.license_serials
add column if not exists last_notified_on date;


-- Helpful indexes (optional)
create index if not exists idx_license_serials_end_date on public.license_serials(end_date);
create index if not exists idx_license_serials_license_id on public.license_serials(license_id);