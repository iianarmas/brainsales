/**
 * Migration Script: CallFlow to Database
 *
 * This script migrates the static callFlow.ts data to Supabase database tables.
 * Run with: npx tsx scripts/migrate-callflow-to-db.ts
 */

import { createClient } from '@supabase/supabase-js';
import { callFlow } from '../src/data/callFlow';
import { topicGroups } from '../src/data/topicGroups';
import dagre from 'dagre';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Auto-layout algorithm using dagre
function generateNodePositions() {
  const g = new dagre.graphlib.Graph();

  // Configure graph
  g.setGraph({
    rankdir: 'TB', // Top to bottom
    nodesep: 100,  // Vertical space between nodes
    ranksep: 150,  // Horizontal space between ranks
    align: 'UL',   // Up-left alignment
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  Object.values(callFlow).forEach((node) => {
    g.setNode(node.id, {
      width: 250,
      height: 150,
    });
  });

  // Add edges (responses)
  Object.values(callFlow).forEach((node) => {
    node.responses.forEach((response) => {
      g.setEdge(node.id, response.nextNode);
    });
  });

  // Run layout
  dagre.layout(g);

  // Extract positions
  const positions: Record<string, { x: number; y: number }> = {};
  g.nodes().forEach((nodeId) => {
    const nodeWithPosition = g.node(nodeId);
    positions[nodeId] = {
      x: nodeWithPosition.x,
      y: nodeWithPosition.y,
    };
  });

  return positions;
}

async function main() {
  console.log('🚀 Starting CallFlow migration to database...\n');

  try {
    // Step 1: Insert topic groups
    console.log('📝 Inserting topic groups...');

    // Map icon components to their names
    const iconNameMap: Record<string, string> = {
      opening: 'Play',
      discovery: 'Search',
      ehr: 'Server',
      dms: 'Database',
      pitch: 'Lightbulb',
      close: 'Calendar',
      end: 'Flag',
    };

    for (const topic of topicGroups) {
      const iconName = iconNameMap[topic.id] || 'Circle';

      const { error } = await supabase
        .from('topic_groups')
        .upsert({
          id: topic.id,
          label: topic.label,
          icon: iconName,
          color: topic.color,
          sort_order: topicGroups.indexOf(topic),
        });

      if (error) {
        console.error(`  ❌ Failed to insert topic "${topic.label}":`, error.message);
      } else {
        console.log(`  ✅ Inserted topic: ${topic.label}`);
      }
    }

    // Step 2: Generate positions
    console.log('\n🗺️  Generating node positions with dagre...');
    const positions = generateNodePositions();
    console.log(`  ✅ Generated positions for ${Object.keys(positions).length} nodes`);

    // Step 3: Insert call nodes
    console.log('\n📦 Inserting call nodes...');
    const nodeCount = Object.keys(callFlow).length;
    let insertedNodes = 0;

    for (const [nodeId, node] of Object.entries(callFlow)) {
      // Find topic group for this node
      const topicGroup = topicGroups.find((t) => t.nodes.includes(nodeId));
      const position = positions[nodeId] || { x: 0, y: 0 };

      const { error } = await supabase
        .from('call_nodes')
        .upsert({
          id: node.id,
          type: node.type,
          title: node.title,
          script: node.script,
          context: node.context || null,
          metadata: node.metadata || null,
          position_x: position.x,
          position_y: position.y,
          topic_group_id: topicGroup?.id || null,
          sort_order: 0,
          is_active: true,
        });

      if (error) {
        console.error(`  ❌ Failed to insert node "${node.title}":`, error.message);
        continue;
      }

      insertedNodes++;

      // Insert keypoints
      if (node.keyPoints && node.keyPoints.length > 0) {
        for (let i = 0; i < node.keyPoints.length; i++) {
          await supabase
            .from('call_node_keypoints')
            .insert({
              node_id: node.id,
              keypoint: node.keyPoints[i],
              sort_order: i,
            });
        }
      }

      // Insert warnings
      if (node.warnings && node.warnings.length > 0) {
        for (let i = 0; i < node.warnings.length; i++) {
          await supabase
            .from('call_node_warnings')
            .insert({
              node_id: node.id,
              warning: node.warnings[i],
              sort_order: i,
            });
        }
      }

      // Insert listen_for
      if (node.listenFor && node.listenFor.length > 0) {
        for (let i = 0; i < node.listenFor.length; i++) {
          await supabase
            .from('call_node_listen_for')
            .insert({
              node_id: node.id,
              listen_item: node.listenFor[i],
              sort_order: i,
            });
        }
      }

      if (insertedNodes % 10 === 0) {
        console.log(`  Progress: ${insertedNodes}/${nodeCount} nodes`);
      }
    }

    console.log(`  ✅ Inserted ${insertedNodes} nodes\n`);

    // Step 4: Insert responses (connections)
    console.log('🔗 Inserting responses and connections...');
    let insertedResponses = 0;
    let invalidConnections = 0;

    for (const node of Object.values(callFlow)) {
      if (node.responses && node.responses.length > 0) {
        for (let i = 0; i < node.responses.length; i++) {
          const response = node.responses[i];

          // Validate connection exists
          if (!callFlow[response.nextNode]) {
            console.warn(`  ⚠️  Invalid connection: ${node.id} -> ${response.nextNode} (target not found)`);
            invalidConnections++;
            continue;
          }

          const { error } = await supabase
            .from('call_node_responses')
            .insert({
              node_id: node.id,
              label: response.label,
              next_node_id: response.nextNode,
              note: response.note || null,
              sort_order: i,
            });

          if (error) {
            console.error(`  ❌ Failed to insert response "${response.label}":`, error.message);
          } else {
            insertedResponses++;
          }
        }
      }
    }

    console.log(`  ✅ Inserted ${insertedResponses} responses`);
    if (invalidConnections > 0) {
      console.warn(`  ⚠️  Skipped ${invalidConnections} invalid connections`);
    }

    // Step 5: Validation
    console.log('\n✅ Validating migration...');

    const { count: nodesCount } = await supabase
      .from('call_nodes')
      .select('*', { count: 'exact', head: true });

    const { count: responsesCount } = await supabase
      .from('call_node_responses')
      .select('*', { count: 'exact', head: true });

    const { count: topicsCount } = await supabase
      .from('topic_groups')
      .select('*', { count: 'exact', head: true });

    console.log(`  📊 Nodes in database: ${nodesCount}`);
    console.log(`  📊 Responses in database: ${responsesCount}`);
    console.log(`  📊 Topics in database: ${topicsCount}`);

    console.log('\n✨ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Supabase dashboard');
    console.log('2. Run the app and check that scripts load correctly');
    console.log('3. Test the Script Editor interface');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
