import { createClient } from '@supabase/supabase-js';
import { StorageService } from './storageService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : '');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: StorageService.supabaseAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});
