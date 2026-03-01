import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const orgId = '75836c1e-7253-4886-8fa8-04e4e9638c11'; // A known orgId if possible, or I'll fetch one.

    const { data: orgs } = await supabaseAdmin.from('organizations').select('id').limit(1);
    const targetOrgId = orgs?.[0]?.id;

    if (!targetOrgId) {
        console.log('No org found');
        return;
    }

    const kbResult = await supabaseAdmin
        .from("kb_updates")
        .select("id, title, target_product_id")
        .eq("status", "published")
        .eq("organization_id", targetOrgId)
        .order("published_at", { ascending: false })
        .range(0, 4);

    console.log('KB_UPDATES_DATA_SAMPLE:', kbResult.data?.slice(0, 1));

    const kbRates = (kbResult.data || []).map(u => ({
        id: u.id,
        title: u.title,
        type: 'kb' as const
    }));

    console.log('KB_RATES_SAMPLE:', kbRates.slice(0, 1));
}

diagnose();
