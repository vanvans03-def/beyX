alter table public.tournaments
    add column if not exists ranking_badges_snapshot jsonb,
    add column if not exists ranking_badges_snapshotted_at timestamptz;

comment on column public.tournaments.ranking_badges_snapshot is
    'Immutable ranking badge snapshot captured from registered players when the tournament starts.';
