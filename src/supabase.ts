import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// WanderMan's Supabase project (Frankfurt). The public key below is meant to sit in the app: what each
// person can read or write is decided by the rules on the server, not by keeping this key secret.
export const SUPABASE_URL = 'https://nzlkutgbzoczpgegvyyx.supabase.co';
// The publishable key, from Supabase: Project Settings, API Keys. Given by Yvan on 22 Nov 2026.
export const SUPABASE_KEY: string = 'sb_publishable_Rg9b4_6Fkee_TcstvKyrgQ_dNfBfTZd';

export const supabase: SupabaseClient | undefined = SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : undefined;
