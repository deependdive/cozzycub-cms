-- Run this in the Supabase SQL editor.
-- The widgets table already existed from earlier scaffolding with a richer
-- schema (type, description, config, preview_image_url, is_active). Since
-- the table has 0 rows, this simplifies it down to just what the widgets
-- module needs: id, name (unique), json_data, created_at, updated_at.

-- Drop all existing policies first — some reference columns we're about to drop.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'widgets'
  loop
    execute format('drop policy if exists %I on public.widgets', pol.policyname);
  end loop;
end $$;

alter table widgets drop column if exists type;
alter table widgets drop column if exists description;
alter table widgets drop column if exists preview_image_url;
alter table widgets drop column if exists is_active;

alter table widgets rename column config to json_data;
alter table widgets alter column json_data set default '{}'::jsonb;
alter table widgets alter column json_data set not null;

-- Case-insensitive uniqueness: "Hero Banner" and "hero banner" collide.
create unique index if not exists widgets_name_unique_idx on widgets (lower(name));

alter table widgets enable row level security;

create policy "Public read access" on widgets
  for select using (true);
