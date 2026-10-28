-- Add Strova Technology's integrated pillars to new portal project records.
-- Keep the previous values so existing orders remain valid and readable.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_division_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_division_check
  CHECK (division IN ('technologies', 'digital', 'commerce', 'automation', 'products'));
