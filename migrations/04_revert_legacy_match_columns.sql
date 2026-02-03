-- Revert accidental addition of legacy locking fields on matches table
-- FIX: Corrected syntax to use "IF EXISTS" instead of "IF NOT EXISTS"

ALTER TABLE public.matches
DROP COLUMN IF EXISTS locked_by,
DROP COLUMN IF EXISTS judge_name,
DROP COLUMN IF EXISTS locked_at;
