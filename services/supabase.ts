// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// if (!supabaseUrl || !supabaseAnonKey) {
//     console.error('Supabase credentials missing in .env.local');
// }

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock Supabase client for Offline Mode
export const supabase = {
    auth: {
        signUp: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
        updateUser: async () => ({ error: null }),
        resetPasswordForEmail: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    },
    from: () => ({
        select: () => ({
            order: () => ({
                eq: () => ({
                    single: async () => ({ data: null, error: null }),
                    maybeSingle: async () => ({ data: null, error: null }),
                }),
                limit: async () => ({ data: [], error: null }),
            }),
            eq: () => ({
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
                in: async () => ({ error: null }),
            }),
            maybeSingle: async () => ({ data: null, error: null }),
        }),
        insert: async () => ({ data: null, error: null }),
        upsert: async () => ({ data: null, error: null }),
        update: async () => ({ error: null }),
        delete: async () => ({ error: null }),
        rpc: async () => ({ data: null, error: null }),
    }),
    rpc: async () => ({ data: null, error: null }),
} as any;
