-- Fix Tournament Status Constraint
-- The original constraint only allowed 'OPEN' and 'CLOSED', but the app uses 'STARTED' and 'COMPLETED'.

-- 1. Drop the old constraint
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;

-- 2. Add the new correct constraint
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_status_check 
  CHECK (status IN ('OPEN', 'CLOSED', 'STARTED', 'COMPLETED'));
