
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function simulateQuery() {
    console.log('Simulating API Query...');

    // Hardcode user ID for testing - replace with a known user ID if possible, 
    // or I'll just rely on what I can see. Since I don't have user ID easily, 
    // I will just fetch ALL published updates without the user filters first
    // to see if the JOINs work.

    try {
        const query = supabaseAdmin
            .from("team_updates")
            .select("*, team:teams(id, name, description), target_product:products(id, name)")
            .eq("status", "published")
            .order("created_at", { ascending: false });

        console.log('Executing query...');
        const { data, error } = await query;

        if (error) {
            console.error('Query Failed:', error);
        } else {
            console.log(`Query Success. Found ${data?.length} rows.`);
            if (data && data.length > 0) {
                console.log('First row team:', data[0].team);
                console.log('First row target_product:', data[0].target_product);
            }
        }
    } catch (err) {
        console.error('JS Error:', err);
    }
}

simulateQuery();
