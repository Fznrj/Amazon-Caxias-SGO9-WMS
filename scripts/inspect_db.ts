
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wwjafnucmhcacdzodgeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3amFmbnVjbWhjYWNkem9kZ2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDMzMjAsImV4cCI6MjA4NzE3OTMyMH0.aKgwa6SlK01Xf12cYTSjNsGELdrQXgtm8oxFunmwnRw';

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
