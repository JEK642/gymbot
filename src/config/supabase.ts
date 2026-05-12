import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env variables into process.env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Validate that keys exist — fail fast if misconfigured
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '❌ Missing Supabase credentials. Check your .env file for SUPABASE_URL and SUPABASE_ANON_KEY.'
  );
}

// Create and export a single Supabase client instance
// This is like your axios instance or React Query client — initialized once, used everywhere
export const supabase = createClient(supabaseUrl, supabaseKey);