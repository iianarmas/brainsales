/**
 * One-Time Backfill: Seed AI Navigation Cache for Existing Nodes
 *
 * Pre-warms ai_navigation_cache with embeddings for all aiCondition phrases
 * across all existing official nodes. After running this, Tier 2 (semantic
 * vector) can handle navigations for every existing call flow — no need to
 * manually re-save each node.
 *
 * Run with:
 *   npx tsx scripts/seed-ai-cache.ts
 *
 * Optional: scope to a single product
 *   PRODUCT_ID=your-product-id npx tsx scripts/seed-ai-cache.ts
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
}
if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

const BATCH_SIZE = 100; // OpenAI embeddings batch limit
const PRODUCT_ID_FILTER = process.env.PRODUCT_ID || null;

function hashPhrase(phrase: string): string {
    return crypto.createHash('sha256').update(phrase.toLowerCase().trim()).digest('hex');
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const startTime = Date.now();
    console.log('🌱 Seeding AI navigation cache for existing nodes...\n');

    // 1. Fetch all products (or just the one specified)
    let productsQuery = supabase.from('products').select('id, name');
    if (PRODUCT_ID_FILTER) {
        productsQuery = productsQuery.eq('id', PRODUCT_ID_FILTER);
    }
    const { data: products, error: productsError } = await productsQuery;
    if (productsError) {
        console.error('❌ Failed to fetch products:', productsError.message);
        process.exit(1);
    }
    if (!products || products.length === 0) {
        console.log('No products found. Nothing to seed.');
        return;
    }

    let totalSeeded = 0;
    let totalSkipped = 0;

    for (const product of products) {
        console.log(`Product: ${product.name}  (${product.id})`);

        // 2. Fetch all official nodes for this product
        const { data: nodes, error: nodesError } = await supabase
            .from('call_nodes')
            .select('id, organization_id')
            .eq('product_id', product.id)
            .eq('scope', 'official');

        if (nodesError) {
            console.error(`  ❌ Failed to fetch nodes: ${nodesError.message}`);
            continue;
        }
        if (!nodes || nodes.length === 0) {
            console.log('  No nodes found, skipping.\n');
            continue;
        }

        const nodeIds = nodes.map(n => n.id);
        // Use the org_id from the first node (all nodes in a product share the same org)
        const organizationId = nodes[0].organization_id;

        // 3. Fetch all responses with aiCondition values for these nodes
        const { data: responses, error: responsesError } = await supabase
            .from('call_node_responses')
            .select('node_id, ai_condition, next_node_id')
            .in('node_id', nodeIds)
            .not('ai_condition', 'is', null)
            .eq('is_special_instruction', false);

        if (responsesError) {
            console.error(`  ❌ Failed to fetch responses: ${responsesError.message}`);
            continue;
        }

        // Collect unique (phrase, nodeId) pairs — deduplicate by phrase
        const seen = new Set<string>();
        const conditions: Array<{ phrase: string; nodeId: string }> = [];
        for (const r of responses || []) {
            if (!r.ai_condition || !r.next_node_id) continue;
            const key = r.ai_condition.toLowerCase().trim();
            if (!seen.has(key)) {
                seen.add(key);
                conditions.push({ phrase: r.ai_condition, nodeId: r.next_node_id });
            }
        }

        console.log(`  Found ${conditions.length} aiCondition phrases across ${nodeIds.length} nodes`);

        if (conditions.length === 0) {
            console.log('  No aiCondition phrases found, skipping.\n');
            continue;
        }

        // 4. Skip phrases already in the cache for this product
        const phraseHashes = conditions.map(c => hashPhrase(c.phrase));
        const { data: existing } = await supabase
            .from('ai_navigation_cache')
            .select('phrase_hash')
            .eq('product_id', product.id)
            .in('phrase_hash', phraseHashes)
            .is('call_flow_id', null);

        const existingHashes = new Set((existing || []).map((e: any) => e.phrase_hash));
        const newConditions = conditions.filter((_, i) => !existingHashes.has(phraseHashes[i]));

        const skipCount = conditions.length - newConditions.length;
        if (skipCount > 0) console.log(`  Already cached: ${skipCount}`);

        if (newConditions.length === 0) {
            console.log('  ✓ All phrases already cached.\n');
            totalSkipped += skipCount;
            continue;
        }

        // 5. Batch embed and insert in chunks of BATCH_SIZE
        const numBatches = Math.ceil(newConditions.length / BATCH_SIZE);
        console.log(`  Embedding ${newConditions.length} new phrases in ${numBatches} batch${numBatches > 1 ? 'es' : ''}...`);

        let productSeeded = 0;

        for (let i = 0; i < newConditions.length; i += BATCH_SIZE) {
            const batch = newConditions.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;

            try {
                const embeddingResponse = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: batch.map(c => c.phrase.toLowerCase().trim()),
                });

                const rows = batch.map((c, j) => ({
                    organization_id: organizationId,
                    product_id: product.id,
                    phrase_hash: hashPhrase(c.phrase),
                    phrase_snippet: c.phrase,
                    node_id: c.nodeId,
                    status: 'confirmed',
                    hit_count: 1,
                    embedding: embeddingResponse.data[j].embedding,
                    call_flow_id: null,
                }));

                const { error: insertError } = await supabase
                    .from('ai_navigation_cache')
                    .insert(rows);

                if (insertError) {
                    if (insertError.code === '23505') {
                        // Race condition or partial overlap — insert individually, skip duplicates
                        let individualSeeded = 0;
                        for (const row of rows) {
                            const { error: singleErr } = await supabase
                                .from('ai_navigation_cache')
                                .insert(row);
                            if (!singleErr || singleErr.code === '23505') {
                                if (!singleErr) individualSeeded++;
                            }
                        }
                        productSeeded += individualSeeded;
                    } else {
                        console.error(`  ⚠️  Batch ${batchNum}/${numBatches} failed: ${insertError.message}`);
                        // Continue with next batch
                    }
                } else {
                    productSeeded += rows.length;
                }

                // Small delay between batches to be polite to OpenAI rate limits
                if (i + BATCH_SIZE < newConditions.length) {
                    await sleep(200);
                }
            } catch (err: any) {
                console.error(`  ⚠️  Batch ${batchNum}/${numBatches} error: ${err.message}`);
                await sleep(1000); // Back off on error
            }
        }

        console.log(`  ✓ Seeded ${productSeeded} entries\n`);
        totalSeeded += productSeeded;
        totalSkipped += skipCount;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('─'.repeat(50));
    console.log(`DONE.`);
    console.log(`  Seeded:  ${totalSeeded} new cache entries`);
    console.log(`  Skipped: ${totalSkipped} already cached`);
    console.log(`  Time:    ${elapsed}s`);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
