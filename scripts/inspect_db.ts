
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrfhqipajiirdxhgpgkd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZmhxaXBhamlpcmR4aGdwZ2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjkxNzMsImV4cCI6MjA4NzA0NTE3M30.sXT7dz6RqAwd8NPa2NqO7M6Pz92E6lnogozSbISmSSE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('Inspecting users table...');
    const { data: users, error } = await supabase
        .from('users')
        .select('*');

    if (error) {
        console.error('Error fetching users:', error);
    } else {
        console.log('Users found:', users.length);
        users.forEach(u => {
            console.log(`- ${u.name} (${u.email}) [Role: ${u.role}, Status: ${u.status}, Company: ${u.company_id}]`);
        });
    }

    console.log('\nInspecting companies table (if exists)...');
    const { data: companies, error: compError } = await supabase
        .from('companies')
        .select('*');

    if (compError) {
        console.error('Error fetching companies:', compError.message);
    } else {
        console.log('Companies found:', companies);
    }
}

inspect();
