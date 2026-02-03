-- Ensure match_locks is accessible
ALTER TABLE public.match_locks DISABLE ROW LEVEL SECURITY;

-- Set Replica Identity to Full to ensure we get all data in updates/deletes
ALTER TABLE public.match_locks REPLICA IDENTITY FULL;

-- Re-run publication add just in case (idempotent-ish usually, but good to be safe)
do $$ 
begin 
  alter publication supabase_realtime add table match_locks; 
exception 
  when duplicate_object then null; 
  when others then null; 
end $$;
