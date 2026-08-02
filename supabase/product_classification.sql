-- Run this in the Supabase SQL editor.
-- Adds a fixed-choice classification to products (kit / figure / coaster /
-- tray / art supply), following the same enum + check-constraint pattern
-- used for promo_codes.applies_to in cart_offers.sql.

alter table products add column if not exists classification text;
alter table products drop constraint if exists products_classification_check;
alter table products add constraint products_classification_check
  check (classification is null or classification in ('kit', 'figure', 'coaster', 'tray', 'art_supply'));
