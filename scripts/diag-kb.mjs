import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
    const { data: categories } = await supabase.from('kb_categories').select('*').order('sort_order');
    const { data: updates } = await supabase
        .from('kb_updates')
        .select('id, title, category_id, competitor_id, product_id, status')
        .order('created_at', { ascending: false })
        .limit(50);

    const mappedUpdates = updates?.map(u => {
        const cat = categories?.find(c => c.id === u.category_id);
        return {
            id: u.id,
            title: u.title,
            category: cat?.name,
            cat_slug: cat?.slug,
            competitor_id: u.competitor_id,
            product_id: u.product_id,
            status: u.status
        };
    });

    const result = {
        categories: categories?.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
        updates: mappedUpdates
    };

    fs.writeFileSync('kb-diag-result.json', JSON.stringify(result, null, 2));
}

diagnostic();
