
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrfhqipajiirdxhgpgkd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZmhxaXBhamlpcmR4aGdwZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjkxNzMsImV4cCI6MjA4NzA0NTE3M30.sXT7dz6RqAwd8NPa2NqO7M6Pz92E6lnogozSbISmSSE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function login_try() {
    const email = 'fernando10frango@gmail.com';
    const passwords = [
        '142536Fernando*',
        '142536Fernando',
        '142536fernando*',
        '142536fernando'
    ];

    for (const pw of passwords) {
        console.log(`Trying login for ${email} with password: ${pw}`);
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: pw
        });

        if (error) {
            console.log('Error:', error.message);
        } else {
            console.log('Login SUCCESS! User ID:', data.user?.id);
            return;
        }
    }
    console.log('All login attempts failed.');
}

login_try();
