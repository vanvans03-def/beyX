-- Create Tournaments Table
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) recommended by Supabase, 
-- but we might need to create policies. For now, we'll leave it as is or enable it.
-- ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Create Registrations Table
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    device_uuid TEXT NOT NULL,
    mode TEXT NOT NULL,
    main_deck JSONB NOT NULL DEFAULT '[]'::jsonb,
    reserve_decks JSONB NOT NULL DEFAULT '[]'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries on tournament_id
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_id ON public.registrations(tournament_id);

-- Optional: Enable RLS
-- ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
