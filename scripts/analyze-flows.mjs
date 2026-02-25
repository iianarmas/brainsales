// analyze-flows.mjs
// Reads .env.local, queries Supabase for all nodes, identifies HIM/RC/IT flows
// and produces a per-flow analysis of AI Copilot config coverage.

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// --- Read .env.local ---
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

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    // 1. Fetch all official nodes
    const { data: nodes, error } = await supabase
        .from('call_nodes')
        .select('id, type, title, context, metadata, scope')
        .eq('scope', 'official')
        .order('created_at');

    if (error) { console.error('Error fetching nodes:', error.message); process.exit(1); }

    // 2. Fetch listen_for for all nodes
    const nodeIds = nodes.map(n => n.id);
    const { data: listenRows } = await supabase
        .from('call_node_listen_for')
        .select('node_id, listen_item')
        .in('node_id', nodeIds);

    const { data: responseRows } = await supabase
        .from('call_node_responses')
        .select('node_id, label, next_node_id')
        .in('node_id', nodeIds);

    // 3. Build lookup maps
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

    // 4. Find "opening" nodes to identify flows
    const openingNodes = nodes.filter(n => n.type === 'opening');
    console.log('\n=== FLOWS FOUND (by opening node title) ===');
    for (const on of openingNodes) {
        console.log(`  [${on.id}] "${on.title}"`);
    }

    // 5. Find all node IDs reachable from each opening node (BFS)
    const idToNode = Object.fromEntries(nodes.map(n => [n.id, n]));

    function getFlowNodes(startId) {
        const visited = new Set();
        const queue = [startId];
        while (queue.length) {
            const curr = queue.shift();
            if (visited.has(curr)) continue;
            visited.add(curr);
            const responses = responseMap[curr] || [];
            for (const r of responses) {
                if (r.nextNode && !visited.has(r.nextNode)) {
                    queue.push(r.nextNode);
                }
            }
        }
        return [...visited].map(id => idToNode[id]).filter(Boolean);
    }

    // 6. Analyze each flow
    console.log('\n=== PER-FLOW AI COPILOT ANALYSIS ===\n');
    for (const on of openingNodes) {
        const flowTitle = on.title;
        const flowNodes = getFlowNodes(on.id);
        const total = flowNodes.length;

        let hasIntent = 0, noIntent = [];
        let hasTriggers = 0, noTriggers = [];
        let hasListenFor = 0, noListenFor = [];
        let noContext = [];
        let noWarnings = [];
        let triggerCoverageIssues = [];

        for (const node of flowNodes) {
            const meta = node.metadata || {};
            const aiIntent = meta.aiIntent;
            const triggers = meta.aiTransitionTriggers || [];
            const listenFor = listenMap[node.id] || [];
            const responses = responseMap[node.id] || [];

            // aiIntent
            if (aiIntent && aiIntent.trim()) {
                hasIntent++;
            } else {
                noIntent.push(`  - [${node.id}] "${node.title}" (${node.type})`);
            }

            // aiTransitionTriggers
            if (triggers.length > 0) {
                hasTriggers++;
            } else {
                // Only flag nodes that have responses (end/success nodes don't need triggers)
                if (responses.length > 0) {
                    noTriggers.push(`  - [${node.id}] "${node.title}" (${node.type})`);
                }
            }

            // Trigger coverage: does each response path have a matching trigger?
            if (triggers.length > 0 && responses.length > 0) {
                const coveredTargets = new Set(triggers.map(t => t.targetNodeId));
                const missingCoverage = responses.filter(r => !coveredTargets.has(r.nextNode));
                if (missingCoverage.length > 0) {
                    triggerCoverageIssues.push(
                        `  - [${node.id}] "${node.title}": missing triggers for paths → ${missingCoverage.map(r => r.nextNode).join(', ')}`
                    );
                }
            }

            // listenFor
            if (listenFor.length >= 3) {
                hasListenFor++;
            } else {
                if (node.type !== 'end' && node.type !== 'success' && node.type !== 'voicemail') {
                    noListenFor.push(`  - [${node.id}] "${node.title}" (${node.type}) — has ${listenFor.length}`);
                }
            }

            // context
            if (!node.context || !node.context.trim()) {
                if (node.type !== 'end' && node.type !== 'success' && node.type !== 'voicemail') {
                    noContext.push(`  - [${node.id}] "${node.title}" (${node.type})`);
                }
            }
        }

        const countWithResponses = flowNodes.filter(n => (responseMap[n.id] || []).length > 0).length;

        console.log(`╔════════════════════════════════════════════════════`);
        console.log(`║ FLOW: "${flowTitle}"`);
        console.log(`║ Opening Node: [${on.id}]`);
        console.log(`║ Total Reachable Nodes: ${total}`);
        console.log(`╠════════════════════════════════════════════════════`);
        console.log(`║ aiIntent:`);
        console.log(`║   Filled in: ${hasIntent} / ${total} nodes`);
        if (noIntent.length) {
            console.log(`║   ⚠ Missing on:`);
            noIntent.forEach(l => console.log(`║  ${l}`));
        }
        console.log(`╠════════════════════════════════════════════════════`);
        console.log(`║ aiTransitionTriggers (nodes with responses):`);
        console.log(`║   Has triggers: ${hasTriggers} / ${countWithResponses} interactive nodes`);
        if (noTriggers.length) {
            console.log(`║   ⚠ No triggers on:`);
            noTriggers.forEach(l => console.log(`║  ${l}`));
        }
        if (triggerCoverageIssues.length) {
            console.log(`║   ⚠ Incomplete trigger coverage (has triggers but missing paths):`);
            triggerCoverageIssues.forEach(l => console.log(`║  ${l}`));
        }
        console.log(`╠════════════════════════════════════════════════════`);
        console.log(`║ listenFor (≥3 phrases):`);
        console.log(`║   Adequate: ${hasListenFor} interactive nodes`);
        if (noListenFor.length) {
            console.log(`║   ⚠ Missing/insufficient on:`);
            noListenFor.forEach(l => console.log(`║  ${l}`));
        }
        console.log(`╠════════════════════════════════════════════════════`);
        console.log(`║ context field:`);
        if (noContext.length === 0) {
            console.log(`║   ✓ All interactive nodes have context`);
        } else {
            console.log(`║   ⚠ Missing on:`);
            noContext.forEach(l => console.log(`║  ${l}`));
        }
        console.log(`╚════════════════════════════════════════════════════\n`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
