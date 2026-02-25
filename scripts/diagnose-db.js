
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
    console.log('--- Database Diagnostics ---');

    const { data: orgs } = await supabase.from('organizations').select('id, name, slug');
    console.log('Organizations:', orgs?.length || 0);
    orgs?.forEach(o => console.log(`  - ${o.name} (${o.slug})`));

    const { data: products } = await supabase.from('products').select('id, name, organization_id');
    console.log('\nProducts:', products?.length || 0);
    products?.forEach(p => {
        const org = orgs?.find(o => o.id === p.organization_id);
        console.log(`  - ${p.name} (Org: ${org?.name || p.organization_id})`);
    });

    const { data: teams } = await supabase.from('teams').select('id, name, organization_id, product_id');
    console.log('\nTeams:', teams?.length || 0);
    teams?.forEach(t => {
        const org = orgs?.find(o => o.id === t.organization_id);
        const prod = products?.find(p => p.id === t.product_id);
        console.log(`  - ${t.name} (Org: ${org?.name || t.organization_id}, Product: ${prod?.name || 'NONE'})`);
    });

    const { count: updatesCount } = await supabase.from('kb_updates').select('*', { count: 'exact', head: true });
    console.log('\nTotal KB Updates:', updatesCount || 0);

    const { data: updatesByProd } = await supabase.from('kb_updates').select('product_id');
    const counts = {};
    updatesByProd?.forEach(u => {
        counts[u.product_id] = (counts[u.product_id] || 0) + 1;
    });
    console.log('Updates by Product ID:');
    Object.entries(counts).forEach(([id, count]) => {
        const prod = products?.find(p => p.id === id);
        console.log(`  - ${prod?.name || id}: ${count}`);
    });

    const orphanUpdates = updatesByProd?.filter(u => !products?.find(p => p.id === u.product_id)).length;
    console.log('Orphan KB Updates:', orphanUpdates || 0);

    console.log('\n--- End of Diagnostics ---');
}

diagnose();
