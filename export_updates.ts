import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function exportUpdates() {
    const { data: updates } = await supabaseAdmin
        .from('team_updates')
        .select('*');

    fs.writeFileSync('all_team_updates.json', JSON.stringify(updates, null, 2));
    console.log(`Exported ${updates?.length || 0} updates`);
}

exportUpdates();
