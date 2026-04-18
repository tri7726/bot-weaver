import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from both root and mindcraft-core directories
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });

// Try multiple environment variable names for compatibility
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing in .env');
  console.error('Available env vars:', {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  });
  throw new Error('supabaseUrl and supabaseKey are required.');
}

console.log('Supabase client initialized successfully');
export const supabase = createClient(supabaseUrl, supabaseKey);
