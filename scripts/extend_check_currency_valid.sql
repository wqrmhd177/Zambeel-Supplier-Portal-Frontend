-- Fix Add Supplier "check_currency_valid" errors (run in Supabase → SQL Editor).
-- Step 1: See the current rule
SELECT pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'check_currency_valid';

-- Step 2: Replace with allowed ISO codes for all 9 markets (includes USD for USA)
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_currency_valid;

ALTER TABLE users ADD CONSTRAINT check_currency_valid
  CHECK (
    currency IS NULL
    OR currency IN (
      'PKR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'IQD', 'USD'
    )
  );
