import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials');
}

// 1. Client for public/anon operations (if any)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Admin client for reliable server-side operations (bypasses RLS)
export const supabaseAdmin = SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY)
    : supabase; // Fallback to anon (will fail RLS if configured)
