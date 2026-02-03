create table if not exists match_locks (
  match_id bigint primary key,
  tournament_id uuid not null,
  judge_name text not null,
  judge_shop text,
  user_id text not null,
  arena_number int,
  created_at timestamptz default now()
);

-- Enable Realtime for this table
alter publication supabase_realtime add table match_locks;
