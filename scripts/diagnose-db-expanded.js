
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
    console.log('=== DETAILED DIAGNOSTICS ===');

    const { data: orgs } = await supabase.from('organizations').select('*');
    console.log(`\nOrganizations (${orgs?.length || 0}):`);
    orgs?.forEach(o => console.log(`  - [${o.id}] ${o.name} (${o.slug})`));

    const { data: products } = await supabase.from('products').select('*');
    console.log(`\nProducts (${products?.length || 0}):`);
    products?.forEach(p => {
        const org = orgs?.find(o => o.id === p.organization_id);
        console.log(`  - [${p.id}] ${p.name} (Org: ${org?.name || 'UNKNOWN'})`);
    });

    const { data: categories } = await supabase.from('kb_categories').select('*');
    console.log(`\nKB Categories (${categories?.length || 0}):`);
    categories?.forEach(c => {
        const prod = products?.find(p => p.id === c.product_id);
        console.log(`  - [${c.id}] ${c.name} (Slug: ${c.slug}, Product: ${prod?.name || (c.product_id ? 'ORPHAN: ' + c.product_id : 'GLOBAL')})`);
    });

    const { count: updatesCount } = await supabase.from('kb_updates').select('*', { count: 'exact', head: true });
    console.log(`\nTOTAL KB UPDATES: ${updatesCount || 0}`);

    // Check for any remaining data in related tables
    const tables = ['call_nodes', 'topic_groups', 'competitors', 'team_updates'];
    for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`${table}: ${count || 0}`);
    }

    console.log('\n=== END OF DIAGNOSTICS ===');
}

diagnose();
