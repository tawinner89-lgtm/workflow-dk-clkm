import { createClient } from '@supabase/supabase-js';

// These should normally be in .env.local, but since we are generating the structure,
// we set up placeholders that the user can fill later.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
