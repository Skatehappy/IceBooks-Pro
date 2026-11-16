import { createClient } from '@supabase/supabase-js';

const url = window.SUPABASE_URL || '';
const key = window.SUPABASE_ANON_KEY || '';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
export const SUPABASE_URL = url;
