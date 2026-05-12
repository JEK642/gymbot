import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '❌ Missing Supabase credentials. Check your .env file for SUPABASE_URL and SUPABASE_ANON_KEY.'
  );
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws
  }
});