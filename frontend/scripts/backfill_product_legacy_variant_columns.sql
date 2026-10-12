-- Run once in Supabase SQL editor if CSV-imported products show price/stock 0
-- before the catalog API fix was deployed (syncs first variant onto products row).

UPDATE products p
SET
  variant_id = v.variant_id,
  variant_selling_price = v.price,
  variant_stock = v.stock,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (product_id)
    product_id,
    variant_id,
    price,
    stock
  FROM product_variants
  ORDER BY product_id, variant_id ASC
) v
WHERE p.product_id = v.product_id
  AND (p.variant_id IS NULL OR p.variant_selling_price IS NULL);
