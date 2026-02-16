CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location TEXT,
    map_link TEXT,
    facebook_link TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
