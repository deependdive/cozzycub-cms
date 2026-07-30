-- Run this in the Supabase SQL editor.
-- Tracks files uploaded to the 'widget-media' storage bucket so the CMS can
-- list/reuse them. The bucket itself is already created and public.

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  url text not null,
  size integer not null,
  content_type text not null,
  created_at timestamptz not null default now()
);

alter table media_assets enable row level security;

create policy "Public read access" on media_assets
  for select using (true);
