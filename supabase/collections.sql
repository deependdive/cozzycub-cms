-- Run this in the Supabase SQL editor.
-- The collections and collection_items tables already existed from earlier
-- scaffolding, with exactly the shape needed (collections: id/name/slug;
-- collection_items: collection_id + widget_id + display_order). This adds
-- the constraints and RLS policies the new Collections module relies on.

-- Drop all existing policies first — safe reset before adding fresh ones.
do $$
declare
  pol record;
begin
  for pol in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('collections', 'collection_items')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table collections enable row level security;
alter table collection_items enable row level security;

create policy "Public read access" on collections
  for select using (true);

create policy "Public read access" on collection_items
  for select using (true);

-- Case-insensitive uniqueness on name and slug.
create unique index if not exists collections_name_unique_idx on collections (lower(name));
create unique index if not exists collections_slug_unique_idx on collections (lower(slug));

-- A widget can't appear twice in the same collection.
create unique index if not exists collection_items_widget_unique_idx
  on collection_items (collection_id, widget_id);

-- No two widgets in a collection share a rank; also structurally caps a
-- collection at 100 items (ranks 0-99).
create unique index if not exists collection_items_rank_unique_idx
  on collection_items (collection_id, display_order);

alter table collection_items drop constraint if exists collection_items_display_order_range;
alter table collection_items add constraint collection_items_display_order_range
  check (display_order >= 0 and display_order <= 99);
