-- =====================================================================
--  WOLF EDIT portfolio  -  database schema for Supabase
--  Run this whole file once in:  Supabase dashboard > SQL Editor > New query
--  It is safe to run again: every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Admins
--    Only users listed here can change content. Add yourself after you
--    create your login (see docs/DEPLOY.md, step 4).
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2. Site settings  (brand, hero, about, contact, seo, theme ...)
--    One row per group; the value is a JSON object.
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Projects  (the portfolio videos)
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  description    text not null default '',
  category       text not null default '',
  client         text not null default '',
  video_url      text not null default '',
  thumbnail_url  text not null default '',
  aspect         text not null default 'landscape'
                 check (aspect in ('landscape', 'portrait', 'square')),
  featured       boolean not null default false,
  published      boolean not null default true,
  is_placeholder boolean not null default false,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists projects_position_idx on public.projects (position);

-- ---------------------------------------------------------------------
-- 4. Content items  (services, testimonials, FAQ,
--    process steps, tools, clients, stats, social links)
-- ---------------------------------------------------------------------
create table if not exists public.content_items (
  id         uuid primary key default gen_random_uuid(),
  collection text not null
             check (collection in ('services', 'testimonials', 'faq',
                                   'process', 'tools', 'clients', 'stats', 'socials')),
  position   integer not null default 0,
  data       jsonb not null default '{}'::jsonb,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_items_collection_idx
  on public.content_items (collection, position);

-- ---------------------------------------------------------------------
-- 5. Bookings  ("Book a call" requests, managed in the dashboard)
--    Visitors never write here directly: the website's /api/book
--    endpoint saves rows with the service role key.
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null,
  email          text not null,
  phone          text not null default '',
  service        text not null default '',
  preferred_date text not null default '',
  preferred_time text not null default '',
  message        text not null default '',
  source_page    text not null default '',
  status         text not null default 'new'
                 check (status in ('new', 'contacted', 'confirmed', 'completed', 'cancelled')),
  notes          text not null default ''
);
create index if not exists bookings_created_idx on public.bookings (created_at desc);

-- ---------------------------------------------------------------------
-- 6. Keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_site_settings on public.site_settings;
create trigger touch_site_settings before update on public.site_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_projects on public.projects;
create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_content_items on public.content_items;
create trigger touch_content_items before update on public.content_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 7. Row level security
--    Public visitors: read published content only.
--    Admins: everything.  Bookings: admins only.
-- ---------------------------------------------------------------------
alter table public.admins        enable row level security;
alter table public.site_settings enable row level security;
alter table public.projects      enable row level security;
alter table public.content_items enable row level security;
alter table public.bookings      enable row level security;

-- admins: a signed-in user may read only their own row (used by the dashboard login check)
drop policy if exists "admins read own row" on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- site_settings
drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists "settings admin write" on public.site_settings;
create policy "settings admin write" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- projects
drop policy if exists "projects public read" on public.projects;
create policy "projects public read" on public.projects
  for select to anon, authenticated using (published or public.is_admin());

drop policy if exists "projects admin write" on public.projects;
create policy "projects admin write" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- content_items
drop policy if exists "content public read" on public.content_items;
create policy "content public read" on public.content_items
  for select to anon, authenticated using (published or public.is_admin());

drop policy if exists "content admin write" on public.content_items;
create policy "content admin write" on public.content_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- bookings: admins only (the website writes through the service role key)
drop policy if exists "bookings admin all" on public.bookings;
create policy "bookings admin all" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- table privileges (RLS still decides which rows are visible)
grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.projects, public.content_items to anon;
grant select, insert, update, delete
  on public.site_settings, public.projects, public.content_items, public.bookings
  to authenticated;
grant select on public.admins to authenticated;
revoke all on public.bookings from anon;

-- ---------------------------------------------------------------------
-- 8. Storage bucket for uploaded thumbnails and videos
--    Public read (so the website can show them), admin-only write.
--    The free plan caps each file at 50 MB; for bigger videos paste a
--    YouTube or Google Drive link instead.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists "media admin insert" on storage.objects;
create policy "media admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------------
-- 9. Make yourself an admin  (run AFTER you create your login in
--    Authentication > Users). Replace the email if needed.
-- ---------------------------------------------------------------------
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'dewanksaini18@gmail.com'
-- on conflict do nothing;
