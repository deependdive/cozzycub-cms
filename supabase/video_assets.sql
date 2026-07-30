-- Run this in the Supabase SQL editor.
-- Tracks HLS video assets. 'url' points at the .m3u8 playlist in the public
-- 'widget-video' bucket, produced by remuxing an upload from the private
-- 'widget-video-raw' bucket via ffmpeg. Both buckets are already created.

create table if not exists video_assets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  url text not null,
  size bigint not null,
  content_type text not null,
  created_at timestamptz not null default now()
);

alter table video_assets enable row level security;

create policy "Public read access" on video_assets
  for select using (true);
