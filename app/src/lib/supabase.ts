import { createClient } from '@supabase/supabase-js';

function readRequiredPublicConfig(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.startsWith('YOUR_') || trimmed.startsWith('your_')) {
    throw new Error(`Missing ${name}. Set it in the release build environment.`);
  }

  return trimmed;
}

const supabaseUrl = readRequiredPublicConfig('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = readRequiredPublicConfig('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
