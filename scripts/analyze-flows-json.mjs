// analyze-flows-json.mjs
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => {
            const idx = l.indexOf('=');
            return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        })
);

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    const { data: nodes, error } = await supabase
        .from('call_nodes')
        .select('id, type, title, context, metadata, scope')
        .eq('scope', 'official')
        .order('created_at');

    if (error) { console.error(JSON.stringify({ error: error.message })); process.exit(1); }

    const nodeIds = nodes.map(n => n.id);
    const { data: listenRows } = await supabase
        .from('call_node_listen_for')
        .select('node_id, listen_item')
        .in('node_id', nodeIds);

    const { data: responseRows } = await supabase
        .from('call_node_responses')
        .select('node_id, label, next_node_id')
        .in('node_id', nodeIds);

    const listenMap = {};
    for (const r of (listenRows || [])) {
        if (!listenMap[r.node_id]) listenMap[r.node_id] = [];
        listenMap[r.node_id].push(r.listen_item);
    }
    const responseMap = {};
    for (const r of (responseRows || [])) {
        if (!responseMap[r.node_id]) responseMap[r.node_id] = [];
        responseMap[r.node_id].push({ label: r.label, nextNode: r.next_node_id });
    }

    const idToNode = Object.fromEntries(nodes.map(n => [n.id, n]));
    const openingNodes = nodes.filter(n => n.type === 'opening');

    function getFlowNodes(startId) {
        const visited = new Set();
        const queue = [startId];
        while (queue.length) {
            const curr = queue.shift();
            if (visited.has(curr)) continue;
            visited.add(curr);
            for (const r of (responseMap[curr] || [])) {
                if (r.nextNode && !visited.has(r.nextNode)) queue.push(r.nextNode);
            }
        }
        return [...visited].map(id => idToNode[id]).filter(Boolean);
    }

    const result = { flows: [] };

    for (const on of openingNodes) {
        const flowNodes = getFlowNodes(on.id);
        const total = flowNodes.length;

        const noIntent = [];
        const noTriggers = [];
        const incompleteTriggers = [];
        const noListenFor = [];
        const noContext = [];

        for (const node of flowNodes) {
            const meta = node.metadata || {};
            const aiIntent = meta.aiIntent;
            const triggers = meta.aiTransitionTriggers || [];
            const listenFor = listenMap[node.id] || [];
            const responses = responseMap[node.id] || [];

            if (!aiIntent || !aiIntent.trim()) {
                noIntent.push({ id: node.id, title: node.title, type: node.type });
            }

            if (responses.length > 0 && triggers.length === 0) {
                noTriggers.push({ id: node.id, title: node.title, type: node.type });
            }

            if (triggers.length > 0 && responses.length > 0) {
                const coveredTargets = new Set(triggers.map(t => t.targetNodeId));
                const missing = responses.filter(r => !coveredTargets.has(r.nextNode));
                if (missing.length > 0) {
                    incompleteTriggers.push({ id: node.id, title: node.title, missingPaths: missing.map(r => r.nextNode) });
                }
            }

            if (node.type !== 'end' && node.type !== 'success' && node.type !== 'voicemail') {
                if (listenFor.length < 3) {
                    noListenFor.push({ id: node.id, title: node.title, type: node.type, count: listenFor.length });
                }
                if (!node.context || !node.context.trim()) {
                    noContext.push({ id: node.id, title: node.title, type: node.type });
                }
            }
        }

        const interactiveNodes = flowNodes.filter(n => (responseMap[n.id] || []).length > 0);
        const hasIntent = total - noIntent.length;
        const hasTriggers = interactiveNodes.length - noTriggers.length;

        result.flows.push({
            openingTitle: on.title,
            openingId: on.id,
            totalNodes: total,
            aiIntent: { filled: hasIntent, total, missing: noIntent },
            aiTriggers: { filled: hasTriggers, interactiveTotal: interactiveNodes.length, missing: noTriggers, incomplete: incompleteTriggers },
            listenFor: { missing: noListenFor },
            context: { missing: noContext }
        });
    }

    process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch(e => { console.error(JSON.stringify({ fatal: e.message })); process.exit(1); });
