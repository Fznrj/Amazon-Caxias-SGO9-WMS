import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wwjafnucmhcacdzodgeg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3amFmbnVjbWhjYWNkem9kZ2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDMzMjAsImV4cCI6MjA4NzE3OTMyMH0.aKgwa6SlK01Xf12cYTSjNsGELdrQXgtm8oxFunmwnRw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser() {
    console.log('Checking for user: fernando10frango@gmail.com');
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'fernando10frango@gmail.com')
        .maybeSingle();

    if (error) {
        console.error('Error:', error);
    } else if (data) {
        console.log('User found in public.users:', data);
    } else {
        console.log('User NOT found in public.users');

        // Let's also check if ANY users exist
        const { data: allUsers, error: allUsersError } = await supabase
            .from('users')
            .select('email')
            .limit(5);

        if (allUsersError) {
            console.error('Error fetching all users:', allUsersError);
        } else {
            console.log('Other users in table:', allUsers);
        }
    }
}

checkUser();
