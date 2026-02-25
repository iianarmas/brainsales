require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: q1 } = await supabase.from('team_updates').select('organization_id, title').eq('is_broadcast', true);
    console.log("All broadcasts:", q1);
    process.exit(0);
}
test();
