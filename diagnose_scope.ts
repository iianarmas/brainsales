import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const { data: updates } = await supabaseAdmin
        .from('team_updates')
        .select('id, title, is_broadcast, team_id, organization_id')
        .or('title.ilike.%Dexit%,title.ilike.%Event%');

    console.log('UPDATE_SCOPES:');
    updates?.forEach(u => {
        console.log(`${u.title} | Broadcast: ${u.is_broadcast} | TeamID: ${u.team_id} | OrgID: ${u.organization_id}`);
    });
}

diagnose();
