/**
 * Dexit Knowledge Base CLI Tool
 *
 * Usage:
 *   npx tsx scripts/dexit-kb-cli.ts <command> [options]
 *
 * Commands:
 *   add-release   --version "10.3" --date "2026-02-01" --features "feat1,feat2" [--status published]
 *   add-news      --title "..." --content "..." [--priority high] [--status published]
 *   add-feature   --title "..." --content "..." [--tags "tag1,tag2"]
 *   add-blog      --title "..." --content "..." [--tags "tag1,tag2"]
 *   add-metric    --title "..." --metric-name "Accuracy" --new-value "98%" [--old-value "97%"]
 *   add-team-update --team "engineering" --title "..." --content "..." [--priority high] [--require-ack]
 *   import-json   <path-to-json>
 *   publish       <update-id>
 *   list          [--category release] [--status draft] [--limit 10]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = 'true';
      }
    } else if (!result._positional) {
      result._positional = args[i];
    }
  }
  return result;
}

async function getCategoryId(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from('kb_categories')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error || !data) throw new Error(`Category not found: ${slug}`);
  return data.id;
}

async function addRelease(opts: Record<string, string>) {
  const version = opts.version;
  const date = opts.date;
  const featureNames = (opts.features || '').split(',').map((f) => f.trim()).filter(Boolean);
  const status = opts.status || 'draft';

  if (!version) throw new Error('--version is required');

  const catId = await getCategoryId('release');
  const featureList = featureNames.join(', ');

  const { data: update, error } = await supabase
    .from('kb_updates')
    .insert({
      category_id: catId,
      title: `Dexit ${version}`,
      content: `Released: ${date || 'TBD'}\n\nFeatures: ${featureList || 'TBD'}`,
      summary: featureList || `Dexit ${version} release`,
      version,
      status,
      priority: opts.priority || 'medium',
      tags: ['release'],
      publish_at: date ? new Date(date).toISOString() : null,
    })
    .select('id')
    .single();

  if (error) throw error;

  if (featureNames.length) {
    await supabase.from('kb_update_features').insert(
      featureNames.map((name, i) => ({ update_id: update.id, name, sort_order: i }))
    );
  }

  console.log(`Created release: Dexit ${version} (id: ${update.id}, status: ${status})`);
}

async function addUpdate(categorySlug: string, opts: Record<string, string>) {
  if (!opts.title) throw new Error('--title is required');
  if (!opts.content) throw new Error('--content is required');

  const catId = await getCategoryId(categorySlug);
  const tags = (opts.tags || '').split(',').map((t) => t.trim()).filter(Boolean);

  const { data, error } = await supabase
    .from('kb_updates')
    .insert({
      category_id: catId,
      title: opts.title,
      content: opts.content,
      summary: opts.summary,
      tags,
      status: opts.status || 'draft',
      priority: opts.priority || 'medium',
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log(`Created ${categorySlug}: "${opts.title}" (id: ${data.id}, status: ${opts.status || 'draft'})`);
}

async function addMetric(opts: Record<string, string>) {
  if (!opts.title) throw new Error('--title is required');

  const catId = await getCategoryId('metrics');

  const { data: update, error } = await supabase
    .from('kb_updates')
    .insert({
      category_id: catId,
      title: opts.title,
      content: `${opts['metric-name'] || 'Metric'}: ${opts['old-value'] || '?'} → ${opts['new-value']}`,
      status: opts.status || 'draft',
      priority: opts.priority || 'medium',
      tags: ['metrics'],
    })
    .select('id')
    .single();

  if (error) throw error;

  if (opts['metric-name'] && opts['new-value']) {
    await supabase.from('kb_update_metrics').insert({
      update_id: update.id,
      metric_name: opts['metric-name'],
      old_value: opts['old-value'],
      new_value: opts['new-value'],
      unit: opts.unit,
    });
  }

  console.log(`Created metric update: "${opts.title}" (id: ${update.id})`);
}

async function addTeamUpdate(opts: Record<string, string>) {
  if (!opts.team) throw new Error('--team is required');
  if (!opts.title) throw new Error('--title is required');
  if (!opts.content) throw new Error('--content is required');

  const { data: team, error: tErr } = await supabase
    .from('teams')
    .select('id')
    .ilike('name', opts.team)
    .single();

  if (tErr || !team) throw new Error(`Team not found: ${opts.team}`);

  const { data, error } = await supabase
    .from('team_updates')
    .insert({
      team_id: team.id,
      title: opts.title,
      content: opts.content,
      priority: opts.priority || 'medium',
      requires_acknowledgment: opts['require-ack'] === 'true',
      status: opts.status || 'draft',
      created_by: '00000000-0000-0000-0000-000000000000', // CLI user placeholder
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log(`Created team update for "${opts.team}": "${opts.title}" (id: ${data.id})`);
}

async function importJson(filePath: string) {
  const abs = resolve(filePath);
  const raw = readFileSync(abs, 'utf-8');
  const updates = JSON.parse(raw);

  if (!Array.isArray(updates)) throw new Error('JSON must be an array of update objects');

  let success = 0;
  let errors = 0;

  for (const item of updates) {
    try {
      const catId = await getCategoryId(item.category_slug || 'news');
      const { error } = await supabase.from('kb_updates').insert({
        category_id: catId,
        title: item.title,
        content: item.content,
        summary: item.summary,
        tags: item.tags || [],
        version: item.version,
        status: item.status || 'draft',
        priority: item.priority || 'medium',
      });
      if (error) throw error;
      success++;
    } catch (err) {
      console.error(`Failed to import "${item.title}":`, err);
      errors++;
    }
  }

  console.log(`Import complete: ${success} succeeded, ${errors} failed`);
}

async function publishUpdate(id: string) {
  const { error } = await supabase
    .from('kb_updates')
    .update({ status: 'published' })
    .eq('id', id);

  if (error) throw error;
  console.log(`Published update: ${id}`);
}

async function listUpdates(opts: Record<string, string>) {
  let query = supabase
    .from('kb_updates')
    .select('id, title, status, priority, version, published_at, category:kb_categories(slug)')
    .order('created_at', { ascending: false })
    .limit(parseInt(opts.limit || '10'));

  if (opts.category) {
    const catId = await getCategoryId(opts.category);
    query = query.eq('category_id', catId);
  }
  if (opts.status) query = query.eq('status', opts.status);

  const { data, error } = await query;
  if (error) throw error;

  console.log(`\nFound ${data.length} updates:\n`);
  for (const u of data) {
    const cat = (u.category as unknown as { slug: string })?.slug || '?';
    console.log(`  [${u.status}] ${u.title} (${cat}) ${u.version || ''} - ${u.id}`);
  }
}

// ---- Main ----
async function main() {
  const [, , command, ...rest] = process.argv;
  const opts = parseArgs(rest);

  switch (command) {
    case 'add-release':
      await addRelease(opts);
      break;
    case 'add-news':
      await addUpdate('news', opts);
      break;
    case 'add-feature':
      await addUpdate('feature', opts);
      break;
    case 'add-blog':
      await addUpdate('blog', opts);
      break;
    case 'add-metric':
      await addMetric(opts);
      break;
    case 'add-team-update':
      await addTeamUpdate(opts);
      break;
    case 'import-json':
      await importJson(opts._positional || rest[0]);
      break;
    case 'publish':
      await publishUpdate(opts._positional || rest[0]);
      break;
    case 'list':
      await listUpdates(opts);
      break;
    default:
      console.log(`
Dexit Knowledge Base CLI

Commands:
  add-release     --version "10.3" --date "2026-02-01" --features "feat1,feat2"
  add-news        --title "..." --content "..."
  add-feature     --title "..." --content "..."
  add-blog        --title "..." --content "..."
  add-metric      --title "..." --metric-name "Accuracy" --new-value "98%"
  add-team-update --team "engineering" --title "..." --content "..."
  import-json     <path-to-file.json>
  publish         <update-id>
  list            [--category release] [--status draft] [--limit 10]

Options:
  --status        draft|review|published (default: draft)
  --priority      low|medium|high|urgent (default: medium)
  --tags          Comma-separated tags
  --require-ack   Require acknowledgment (team updates)
`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
