-- Alter users table to add email, role, and feature toggle columns
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS event_mode_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS music_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS tts_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS challonge_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS internal_bracket_enabled BOOLEAN DEFAULT TRUE;

-- Update role of default admin user if exists
UPDATE public.users 
SET role = 'superadmin' 
WHERE username = 'admin';

-- Create beyblades table for global catalog
CREATE TABLE IF NOT EXISTS public.beyblades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    image_url TEXT NOT NULL,
    points_standard INTEGER NOT NULL DEFAULT 0,
    points_south INTEGER NOT NULL DEFAULT 0,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_beyblade_points table for customized user overrides
CREATE TABLE IF NOT EXISTS public.user_beyblade_points (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    beyblade_id UUID NOT NULL REFERENCES public.beyblades(id) ON DELETE CASCADE,
    points_standard INTEGER,
    points_south INTEGER,
    is_banned BOOLEAN,
    PRIMARY KEY (user_id, beyblade_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_beyblade_points_user_id ON public.user_beyblade_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_beyblade_points_beyblade_id ON public.user_beyblade_points(beyblade_id);
