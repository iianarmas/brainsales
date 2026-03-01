import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    // 1. Find a published team update
    const { data: teamUpdates } = await supabaseAdmin
        .from('team_updates')
        .select('id, title')
        .eq('status', 'published')
        .limit(1);

    if (teamUpdates && teamUpdates.length > 0) {
        const id = teamUpdates[0].id;
        console.log(`Diagnosing Team Update: ${teamUpdates[0].title} (${id})`);

        // 2. Query acknowledgments directly
        const { data: acks, error: ackErr } = await supabaseAdmin
            .from('team_update_acknowledgments')
            .select('*')
            .eq('team_update_id', id);

        console.log('ACKS_COUNT:', acks?.length || 0);
        if (ackErr) console.error('ACK_ERROR:', ackErr);
    } else {
        console.log('No published team updates found');
    }
}

diagnose();
