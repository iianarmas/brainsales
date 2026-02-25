/**
 * Migration script: dexit_knowledge_base.json → Supabase
 *
 * Usage: npx tsx scripts/migrate-knowledge-base.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
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

interface CategoryRow { id: string; slug: string }

async function getCategories(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('kb_categories').select('id, slug');
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const c of data as CategoryRow[]) map[c.slug] = c.id;
  return map;
}

async function insertUpdate(
  catId: string,
  title: string,
  content: string,
  opts: { summary?: string; tags?: string[]; version?: string; publishedAt?: string } = {}
): Promise<string> {
  const { data, error } = await supabase
    .from('kb_updates')
    .insert({
      category_id: catId,
      title,
      content,
      summary: opts.summary,
      tags: opts.tags ?? [],
      version: opts.version,
      status: 'published',
      priority: 'medium',
      published_at: opts.publishedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function insertFeatures(updateId: string, features: { name: string; description?: string }[]) {
  if (!features.length) return;
  const { error } = await supabase.from('kb_update_features').insert(
    features.map((f, i) => ({ update_id: updateId, name: f.name, description: f.description, sort_order: i }))
  );
  if (error) throw error;
}

async function insertMetrics(updateId: string, metrics: { metric_name: string; new_value: string; unit?: string }[]) {
  if (!metrics.length) return;
  const { error } = await supabase.from('kb_update_metrics').insert(
    metrics.map((m) => ({ update_id: updateId, ...m }))
  );
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonToMarkdown(obj: any, depth = 0): string {
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map((item) => `- ${typeof item === 'string' ? item : jsonToMarkdown(item, depth + 1)}`).join('\n');
  if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj)
      .map(([key, val]) => {
        const heading = '#'.repeat(Math.min(depth + 3, 6));
        return `${heading} ${key.replace(/_/g, ' ')}\n\n${jsonToMarkdown(val, depth + 1)}`;
      })
      .join('\n\n');
  }
  return String(obj);
}

async function migrate() {
  console.log('Loading dexit_knowledge_base.json...');
  const raw = readFileSync(resolve(__dirname, '../dexit_knowledge_base.json'), 'utf-8');
  const kb = JSON.parse(raw);

  const cats = await getCategories();
  let count = 0;

  // ---- Product Overview ----
  console.log('Importing product overview...');
  await insertUpdate(
    cats['product-info'],
    `${kb.product_name} - ${kb.tagline}`,
    [
      kb.description,
      '',
      `**Company:** ${kb.company}`,
      `**Category:** ${kb.product_category}`,
      '',
      '## Core Value Proposition',
      kb.core_value_proposition.main_message,
      '',
      `**Differentiator:** ${kb.core_value_proposition.differentiator}`,
    ].join('\n'),
    { summary: kb.tagline, tags: ['overview', 'product'] }
  );
  count++;

  // ---- Proprietary Technology ----
  console.log('Importing proprietary technology...');
  const tech = kb.proprietary_technology;
  await insertUpdate(
    cats['technical'],
    `${tech.name} - Proprietary Technology`,
    [
      tech.description,
      '',
      '## Capabilities',
      ...tech.capabilities.map((c: string) => `- ${c}`),
      '',
      `**Training:** ${tech.training}`,
      '',
      '## Accuracy',
      `- Document Classification: ${tech.accuracy.document_classification}`,
      `- Entity Extraction: ${tech.accuracy.entity_extraction}`,
      `- Continuous Improvement: ${tech.accuracy.continuous_improvement}`,
    ].join('\n'),
    { summary: tech.description, tags: ['technology', 'ai', 'dextractlm'] }
  );
  count++;

  // ---- Key Features ----
  console.log('Importing key features...');
  for (const feature of kb.key_features) {
    await insertUpdate(
      cats['feature'],
      feature.name,
      [
        feature.description,
        '',
        feature.details,
        '',
        '## Benefits',
        ...feature.benefits.map((b: string) => `- ${b}`),
      ].join('\n'),
      { summary: feature.description, tags: ['feature'] }
    );
    count++;
  }

  // ---- Workflow Functionalities ----
  console.log('Importing workflow functionalities...');
  for (const wf of kb.workflow_functionalities) {
    const parts = [wf.description, ''];
    if (wf.examples) parts.push('## Examples', ...wf.examples.map((e: string) => `- ${e}`), '');
    if (wf.capabilities) parts.push('## Capabilities', ...wf.capabilities.map((c: string) => `- ${c}`), '');
    if (wf.features) parts.push('## Features', ...wf.features.map((f: string) => `- ${f}`), '');
    if (wf.benefit) parts.push(`**Benefit:** ${wf.benefit}`);
    if (wf.accuracy) parts.push(`**Accuracy:** ${wf.accuracy}`);

    await insertUpdate(
      cats['feature'],
      `Workflow: ${wf.name}`,
      parts.join('\n'),
      { summary: wf.description, tags: ['workflow', 'feature'] }
    );
    count++;
  }

  // ---- Advanced Capabilities ----
  console.log('Importing advanced capabilities...');
  for (const [key, cap] of Object.entries(kb.advanced_capabilities) as [string, Record<string, unknown>][]) {
    await insertUpdate(
      cats['feature'],
      `Advanced: ${key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
      jsonToMarkdown(cap),
      { summary: (cap.description as string) || '', tags: ['advanced', 'feature'] }
    );
    count++;
  }

  // ---- Use Cases ----
  console.log('Importing use cases...');
  for (const uc of kb.use_cases) {
    const parts = [uc.description || '', ''];
    if (uc.workflow_components) parts.push('## Workflow Components', ...uc.workflow_components.map((c: string) => `- ${c}`), '');
    if (uc.features) parts.push('## Features', ...uc.features.map((f: string) => `- ${f}`), '');
    if (uc.introduced) parts.push(`**Introduced:** ${uc.introduced}`);

    await insertUpdate(
      cats['use-case'],
      uc.name,
      parts.join('\n'),
      { summary: uc.description, tags: ['use-case'] }
    );
    count++;
  }

  // ---- Release History ----
  console.log('Importing release history...');
  for (const rel of kb.release_history_highlights) {
    const features = rel.features
      ? rel.features.map((f: string) => ({ name: f }))
      : rel.feature
      ? [{ name: rel.feature }]
      : [];

    const featureList = features.map((f: { name: string }) => f.name).join(', ');
    const updateId = await insertUpdate(
      cats['release'],
      rel.version,
      `Released: ${rel.date}\n\nFeatures: ${featureList}`,
      {
        summary: featureList,
        version: rel.version.replace('Dexit ', ''),
        tags: ['release'],
        publishedAt: new Date(rel.date).toISOString(),
      }
    );
    await insertFeatures(updateId, features);
    count++;
  }

  // ---- Performance Metrics ----
  console.log('Importing performance metrics...');
  const metricsId = await insertUpdate(
    cats['metrics'],
    'Dexit Performance Metrics',
    jsonToMarkdown(kb.performance_metrics),
    { summary: 'Key performance metrics for Dexit', tags: ['metrics', 'performance'] }
  );
  await insertMetrics(metricsId, [
    { metric_name: 'AI Processing Speed', new_value: kb.performance_metrics.processing_speed.ai_enabled },
    { metric_name: 'Manual Processing Speed', new_value: kb.performance_metrics.processing_speed.manual_traditional },
    { metric_name: 'Automation Rate', new_value: kb.performance_metrics.automation_rate },
    { metric_name: 'Entity Extraction Accuracy', new_value: kb.performance_metrics.accuracy_improvement },
    { metric_name: 'Cloud Fax Speed', new_value: kb.performance_metrics.fax_processing.cloud_fax_with_idp },
    { metric_name: 'Record Retrieval Improvement', new_value: kb.performance_metrics.record_retrieval },
  ]);
  count++;

  // ---- Reporting & Analytics ----
  console.log('Importing reporting & analytics...');
  await insertUpdate(
    cats['feature'],
    'Reporting & Analytics',
    jsonToMarkdown(kb.reporting_and_analytics),
    { summary: 'Dexit reporting and analytics capabilities', tags: ['reporting', 'analytics', 'feature'] }
  );
  count++;

  // ---- Security & Compliance ----
  console.log('Importing security & compliance...');
  await insertUpdate(
    cats['compliance'],
    'Security & Compliance',
    jsonToMarkdown(kb.security_and_compliance),
    { summary: 'HIPAA, HITECH, SOC 2 compliance', tags: ['security', 'compliance', 'hipaa'] }
  );
  count++;

  // ---- Document Management Features ----
  console.log('Importing document management features...');
  for (const [key, feature] of Object.entries(kb.document_management_features) as [string, Record<string, unknown>][]) {
    await insertUpdate(
      cats['feature'],
      key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      jsonToMarkdown(feature),
      { tags: ['document-management', 'feature'] }
    );
    count++;
  }

  // ---- Technical Specifications ----
  console.log('Importing technical specifications...');
  await insertUpdate(
    cats['technical'],
    'Technical Specifications',
    jsonToMarkdown(kb.technical_specifications),
    { summary: 'Cloud-native deployment with AI/ML technologies', tags: ['technical', 'specifications'] }
  );
  count++;

  // ---- Competitive Advantages ----
  console.log('Importing competitive advantages...');
  await insertUpdate(
    cats['competitive'],
    'Competitive Advantages',
    kb.competitive_advantages.map((a: string) => `- ${a}`).join('\n'),
    { summary: 'Key competitive differentiators', tags: ['competitive'] }
  );
  count++;

  // ---- Blog Insights ----
  console.log('Importing blog insights...');
  await insertUpdate(
    cats['blog'],
    'Blog Insights & Industry Research',
    [
      '## Key Topics Covered',
      ...kb.blog_insights.key_topics_covered.map((t: string) => `- ${t}`),
      '',
      '## Industry Challenges Addressed',
      ...kb.blog_insights.industry_challenges_addressed.map((c: string) => `- ${c}`),
      '',
      '## CHIME 314e 2025 Survey Findings',
      jsonToMarkdown(kb.blog_insights.chime_314e_2025_survey_findings),
    ].join('\n'),
    { summary: 'Industry insights from blog and surveys', tags: ['blog', 'research', 'survey'] }
  );
  count++;

  // ---- Target Users ----
  console.log('Importing target users...');
  await insertUpdate(
    cats['product-info'],
    'Target Users',
    kb.target_users.map((u: string) => `- ${u}`).join('\n'),
    { summary: 'Healthcare professionals who use Dexit', tags: ['users', 'audience'] }
  );
  count++;

  // ---- Resources ----
  console.log('Importing resources...');
  await insertUpdate(
    cats['product-info'],
    'Dexit Resources & Links',
    Object.entries(kb.resources).map(([key, url]) => `- **${key.replace(/_/g, ' ')}:** ${url}`).join('\n'),
    { summary: 'Official Dexit links and resources', tags: ['resources', 'links'] }
  );
  count++;

  console.log(`\nMigration complete! Imported ${count} updates.`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
