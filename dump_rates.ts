import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const { data: updates } = await supabaseAdmin
        .from('team_updates')
        .select('id, title, status')
        .limit(10);

    console.log('TEAM_UPDATES_RAW:', updates?.map(u => ({ id: u.id, title: u.title })));

    if (updates && updates.length > 0) {
        const item = updates[0];
        const constructedRate = {
            id: item.id,
            title: item.title,
            type: 'team' as const,
            rate: 0.5
        };
        console.log('CONSTRUCTED_RATE_EXAMPLE:', constructedRate);
    }
}

diagnose();
