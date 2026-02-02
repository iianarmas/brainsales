
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    console.log('Checking team_updates columns...');

    // We can't query schema directly easily with JS client without SQL function, 
    // so we'll inspect a row's structure
    const { data, error } = await supabase
        .from('team_updates')
        .select('*')
        .limit(1);

    if (data && data.length > 0) {
        const row = data[0];
        console.log('Row keys:', Object.keys(row));
        console.log('is_broadcast value:', row.is_broadcast, 'Type:', typeof row.is_broadcast);
        console.log('team_id value:', row.team_id, 'Type:', typeof row.team_id);
        console.log('target_product_id value:', row.target_product_id, 'Type:', typeof row.target_product_id);
    } else {
        console.log('No data found to infer schema');
    }
}

checkSchema();
