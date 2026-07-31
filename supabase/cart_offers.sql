-- Run this in the Supabase SQL editor.
-- Builds the temporary (guest, no-auth) cart model and extends promo_codes
-- into a real offers engine (cart / item / delivery-fee discounts).

-- The cart's own id doubles as the client-facing "cart id" — no separate
-- token column needed, same pattern as product_code/collection slug.
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid references promo_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The existing 'cart' table was scaffolded as flat item rows tied to a
-- required user_id, with no grouping concept. Repurpose it as cart_items:
-- add the cart_id grouping key, make user_id optional (guest carts have
-- none), and rename for clarity now that 'carts' exists separately.
alter table cart add column if not exists cart_id uuid references carts(id) on delete cascade;
alter table cart alter column user_id drop not null;

-- Backfill safety: table is empty in practice, but guard anyway before
-- enforcing not null.
delete from cart where cart_id is null;
alter table cart alter column cart_id set not null;

create unique index if not exists cart_items_cart_product_unique_idx on cart (cart_id, product_id);

alter table cart rename to cart_items;

-- Extend promo_codes with what the discount applies to and display copy.
-- discount_percent was originally NOT NULL, but free-delivery-only codes
-- (applies_to='delivery', free_delivery=true) legitimately have neither a
-- percent nor a flat amount set.
alter table promo_codes alter column discount_percent drop not null;

alter table promo_codes add column if not exists applies_to text not null default 'cart';
alter table promo_codes drop constraint if exists promo_codes_applies_to_check;
alter table promo_codes add constraint promo_codes_applies_to_check
  check (applies_to in ('cart', 'item', 'delivery'));

alter table promo_codes add column if not exists free_delivery boolean not null default false;
alter table promo_codes add column if not exists min_quantity integer;
alter table promo_codes add column if not exists max_discount_amount numeric;
alter table promo_codes add column if not exists label text;

create unique index if not exists promo_codes_code_unique_idx on promo_codes (upper(code));

-- Optional product scoping for applies_to = 'item' codes. No rows for a
-- given promo_code_id means "applies to every item in the cart."
create table if not exists promo_code_products (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references promo_codes(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade
);
create unique index if not exists promo_code_products_unique_idx on promo_code_products (promo_code_id, product_id);

-- RLS: unlike every content table so far, carts/cart_items/promo_codes/
-- promo_code_products get NO public read policy. Cart data is per-guest
-- transactional data, and promo_codes includes inactive/expired codes and
-- usage counts — an open anon SELECT would let anyone enumerate other
-- people's carts or every code in the system. Only the service-role API
-- routes touch these tables.
do $$
declare
  pol record;
begin
  for pol in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in
      ('carts', 'cart_items', 'promo_codes', 'promo_code_products')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table carts enable row level security;
alter table cart_items enable row level security;
alter table promo_codes enable row level security;
alter table promo_code_products enable row level security;
