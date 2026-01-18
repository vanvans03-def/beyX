
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS challonge_url TEXT;

ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'single elimination';

-- Add index just in case we query by url later (optional)
CREATE INDEX IF NOT EXISTS idx_tournaments_challonge_url ON public.tournaments(challonge_url);
