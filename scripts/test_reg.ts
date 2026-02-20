
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrfhqipajiirdxhgpgkd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZmhxaXBhamlpcmR4aGdwZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjkxNzMsImV4cCI6MjA4NzA0NTE3M30.sXT7dz6RqAwd8NPa2NqO7M6Pz92E6lnogozSbISmSSE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test_reg() {
    const email = 'master_test_' + Math.random().toString(36).substring(7) + '@example.com';
    const password = 'TestPassword123!';
    const name = 'Test Admin';
    const company_id = 'DeLuna Amazon Caxias SGO9';

    console.log(`Testing registration for: ${email}...`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                company_id
            }
        }
    });

    if (error) {
        console.error('Sign up error:', error.message);
        return;
    }

    console.log('Sign up successful! User ID:', data.user?.id);

    // Wait a bit for trigger
    console.log('Waiting 3 seconds for trigger...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user?.id)
        .maybeSingle();

    if (userError) {
        console.error('Error querying public.users:', userError.message);
    } else if (userData) {
        console.log('User found in public.users:', userData);
    } else {
        console.log('User NOT found in public.users. Trigger might be missing.');
    }
}

test_reg();
