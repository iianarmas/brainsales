import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const orgId = '806bfe46-6d71-4acd-a0a2-36c961e832e0'; // Use the orgId found in dump_updates.ts

    // KB Acknowledgment Range Query
    const { data: publishedUpdatesForAck } = await supabaseAdmin
        .from("kb_updates")
        .select("id, title, target_product_id")
        .eq("status", "published")
        .eq("organization_id", orgId)
        .order("published_at", { ascending: false })
        .range(0, 4);

    console.log('KB_UPDATES_FIRST:', publishedUpdatesForAck?.[0]);

    if (publishedUpdatesForAck && publishedUpdatesForAck.length > 0) {
        const update = publishedUpdatesForAck[0];
        console.log('CONSTRUCTED_KB_RATE:', {
            id: update.id,
            title: update.title,
            type: 'kb' as const
        });
    }
}

diagnose();
