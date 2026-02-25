
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUpdates() {
    console.log('Checking team_updates table...');

    const { data: updates, error } = await supabase
        .from('team_updates')
        .select('*');

    if (error) {
        console.error('Error fetching updates:', error);
        return;
    }

    console.log(`Found ${updates?.length || 0} total updates.`);

    if (updates) {
        updates.forEach(u => {
            console.log(`- [${u.id}] Status: ${u.status}, Broadcast: ${u.is_broadcast}, Team: ${u.team_id}, Target Product: ${u.target_product_id}, Title: ${u.title}`);
        });
    }
}

checkUpdates();
