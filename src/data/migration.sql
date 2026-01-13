-- Migration for Tournament Types and Ban Lists
-- Run this in your Supabase SQL Editor

-- Add 'type' column to tournaments table
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'U10';

-- Add 'ban_list' column to tournaments table
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS ban_list text[] DEFAULT '{}';

-- Optional: Update existing records to have defaults
UPDATE tournaments SET type = 'U10' WHERE type IS NULL;
UPDATE tournaments SET ban_list = '{}' WHERE ban_list IS NULL;
