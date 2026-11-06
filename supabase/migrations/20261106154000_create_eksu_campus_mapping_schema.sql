-- ALTECH EKSU MAP: PostgreSQL + PostGIS schema.
-- This migration matches the current Prisma Location/Photo models.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public."Location" (
  id text primary key,
  name text not null,
  category text not null,
  description text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  "geometryType" text not null default 'point' check ("geometryType" in ('point','polygon','polyline')),
  coordinates text,
  status text not null default 'draft' check (status in ('draft','verified')),
  source text not null default 'admin' check (source in ('admin','sample','import')),
  "externalId" text,
  spatial extensions.geometry(Geometry, 4326),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public."Photo" (
  id text primary key,
  "locationId" text not null references public."Location"(id) on delete cascade,
  filename text not null,
  caption text,
  "createdAt" timestamptz not null default now()
);

create index if not exists "Location_category_idx" on public."Location"(category);
create index if not exists "Location_status_idx" on public."Location"(status);
create index if not exists "Location_name_idx" on public."Location"(name);
create index if not exists "Location_spatial_gix" on public."Location" using gist (spatial);
create index if not exists "Photo_locationId_idx" on public."Photo"("locationId");

alter table public."Location" enable row level security;
alter table public."Photo" enable row level security;

revoke all on table public."Location" from anon, authenticated;
revoke all on table public."Photo" from anon, authenticated;
grant select on table public."Location" to anon, authenticated;
grant select on table public."Photo" to anon, authenticated;

drop policy if exists "Public can read verified campus locations" on public."Location";
create policy "Public can read verified campus locations"
on public."Location" for select to anon, authenticated
using (status = 'verified');

drop policy if exists "Public can read photos for verified campus locations" on public."Photo";
create policy "Public can read photos for verified campus locations"
on public."Photo" for select to anon, authenticated
using (
  exists (
    select 1 from public."Location" l
    where l.id = "Photo"."locationId" and l.status = 'verified'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campus-photos', 'campus-photos', true, 8388608,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view campus photos" on storage.objects;
create policy "Public can view campus photos"
on storage.objects for select to anon, authenticated
using (bucket_id = 'campus-photos');
