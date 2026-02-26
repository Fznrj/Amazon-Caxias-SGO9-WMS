
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wwjafnucmhcacdzodgeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3amFmbnVjbWhjYWNkem9kZ2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDMzMjAsImV4cCI6MjA4NzE3OTMyMH0.aKgwa6SlK01Xf12cYTSjNsGELdrQXgtm8oxFunmwnRw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
    const email = 'fernando10frango@gmail.com';
    const password = '142536Fernando*';
    const name = 'Fernando Souza';
    const company_id = 'DeLuna Amazon Caxias SGO9';

    console.log(`Setting up Master user: ${name} (${email})...`);

    // 1. Try to sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                company_id
            }
        }
    });

    if (signUpError) {
        console.log('Sign up result (expected if already exists):', signUpError.message);
    } else {
        console.log('Sign up successful! User ID:', signUpData.user?.id);
    }

    // 2. Query auth.user to get ID if sign up failed but user exists
    // (Wait, we can't query auth.users with anon key, but we might have signed in if we used signIn)

    // Attempt to sign in to get the ID if user exists
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    let userId = signUpData.user?.id || signInData.user?.id;

    if (!userId) {
        console.error('Could not determine User ID. Check if user exists or password is correct.');
        return;
    }

    console.log('User ID determined:', userId);

    // 3. Upsert into public.users
    const { error: upsertError } = await supabase
        .from('users')
        .upsert({
            id: userId,
            name: name,
            email: email,
            role: 'superadmin',
            status: 'active',
            company_id: company_id,
            created_at: new Date().toISOString()
        });

    if (upsertError) {
        console.error('Error updating public.users:', upsertError.message);
    } else {
        console.log('Successfully updated public.users with superadmin role and active status.');
    }
}

setup();
