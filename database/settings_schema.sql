CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Insert default value for event system status
INSERT INTO system_settings (key, value)
VALUES ('event_system_active', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
