const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const envVars = env.split('\n').reduce((acc, line) => {
    if (line && line.includes('=')) {
        const [key, ...val] = line.split('=');
        acc[key.trim()] = val.join('=').trim();
    }
    return acc;
}, {});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrphans() {
    const { data: listenForNulls } = await supabase
        .from("call_node_listen_for")
        .select("*")
        .is("organization_id", null);

    console.log("ListenFor rows with NULL org_id:", listenForNulls?.length);
    if (listenForNulls?.length > 0) {
        console.log("Sample null org_id record:", listenForNulls.slice(0, 2));
    }

    const { data: allListenFor } = await supabase
        .from("call_node_listen_for")
        .select("node_id, listen_item, organization_id")
        .limit(5);

    console.log("Sample good records:", allListenFor);

    const { data: allNodes } = await supabase
        .from("call_nodes")
        .select("id, organization_id")
        .limit(5);

    console.log("Sample nodes:", allNodes);
}

checkOrphans().catch(console.error);
