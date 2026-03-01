import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data: updates } = await supabase
        .from('team_updates')
        .select('id, title, status, organization_id, is_broadcast, published_at, created_at')
        .or('title.ilike.%Dexit%,title.ilike.%Event%');

    console.log('RECORDS:');
    updates?.forEach(u => {
        console.log(`${u.title} | ID: ${u.id} | Status: ${u.status} | PubAt: ${u.published_at} | Org: ${u.organization_id}`);
    });

    if (updates?.[0]?.organization_id) {
        const { count } = await supabase
            .from('team_updates')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', updates[0].organization_id)
            .eq('status', 'published');
        console.log('TOTAL_PUBLISHED:', count);
    }
}

inspect();
