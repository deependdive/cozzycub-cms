-- Run this in the Supabase SQL editor.
-- Redesigns the products table for the upcoming API-powered product detail
-- page. The table is empty (0 rows), so this is a clean structural change.

alter table products drop column if exists description;
alter table products drop column if exists category_id;
alter table products drop column if exists stock;
alter table products drop column if exists sku;
alter table products drop column if exists price;
alter table products drop column if exists image_url;

alter table products add column if not exists product_code text;
alter table products add column if not exists msrp numeric not null;
alter table products add column if not exists selling_price numeric not null;
alter table products add column if not exists discount_percent integer not null default 0;
alter table products add column if not exists inclusions text[];
alter table products add column if not exists quantity_default integer not null;
alter table products add column if not exists quantity_max integer not null default 20;
alter table products add column if not exists offer_widget_id uuid references widgets(id) on delete set null;
alter table products add column if not exists rich_collection_id uuid references collections(id) on delete set null;
alter table products add column if not exists cta_text text not null default 'Add to Cart';

alter table products alter column name set not null;

alter table products drop constraint if exists products_product_code_format;
alter table products add constraint products_product_code_format check (product_code ~ '^[0-9]{6}$');
create unique index if not exists products_product_code_unique_idx on products (product_code);
alter table products alter column product_code set not null;

create table if not exists product_videos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  video_url text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_name text not null,
  variant_product_id uuid not null references products(id),
  swatch_image_url text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Drop all existing policies first — safe reset before adding fresh ones.
do $$
declare
  pol record;
begin
  for pol in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in
      ('products', 'product_images', 'product_videos', 'product_variants')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table products enable row level security;
alter table product_images enable row level security;
alter table product_videos enable row level security;
alter table product_variants enable row level security;

create policy "Public read access" on products for select using (true);
create policy "Public read access" on product_images for select using (true);
create policy "Public read access" on product_videos for select using (true);
create policy "Public read access" on product_variants for select using (true);
