/**
 * Script to remove duplicate entries in call_node related tables
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicates in call_node related tables...\n');

  // Clean up call_node_keypoints
  console.log('📌 Cleaning call_node_keypoints...');
  const { data: keypoints } = await supabase
    .from('call_node_keypoints')
    .select('*')
    .order('node_id')
    .order('sort_order');

  if (keypoints) {
    const seen = new Set<string>();
    const toDelete: string[] = [];

    for (const kp of keypoints) {
      const key = `${kp.node_id}-${kp.keypoint}`;
      if (seen.has(key)) {
        toDelete.push(kp.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('call_node_keypoints')
        .delete()
        .in('id', toDelete);

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Removed ${toDelete.length} duplicate keypoints`);
      }
    } else {
      console.log('  ✓ No duplicates found');
    }
  }

  // Clean up call_node_warnings
  console.log('\n⚠️ Cleaning call_node_warnings...');
  const { data: warnings } = await supabase
    .from('call_node_warnings')
    .select('*')
    .order('node_id')
    .order('sort_order');

  if (warnings) {
    const seen = new Set<string>();
    const toDelete: string[] = [];

    for (const w of warnings) {
      const key = `${w.node_id}-${w.warning}`;
      if (seen.has(key)) {
        toDelete.push(w.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('call_node_warnings')
        .delete()
        .in('id', toDelete);

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Removed ${toDelete.length} duplicate warnings`);
      }
    } else {
      console.log('  ✓ No duplicates found');
    }
  }

  // Clean up call_node_listen_for
  console.log('\n👂 Cleaning call_node_listen_for...');
  const { data: listenFor } = await supabase
    .from('call_node_listen_for')
    .select('*')
    .order('node_id')
    .order('sort_order');

  if (listenFor) {
    const seen = new Set<string>();
    const toDelete: string[] = [];

    for (const lf of listenFor) {
      const key = `${lf.node_id}-${lf.listen_item}`;
      if (seen.has(key)) {
        toDelete.push(lf.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('call_node_listen_for')
        .delete()
        .in('id', toDelete);

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Removed ${toDelete.length} duplicate listen_for items`);
      }
    } else {
      console.log('  ✓ No duplicates found');
    }
  }

  // Clean up call_node_responses
  console.log('\n🔗 Cleaning call_node_responses...');
  const { data: responses } = await supabase
    .from('call_node_responses')
    .select('*')
    .order('node_id')
    .order('sort_order');

  if (responses) {
    const seen = new Set<string>();
    const toDelete: string[] = [];

    for (const r of responses) {
      const key = `${r.node_id}-${r.label}-${r.next_node_id}`;
      if (seen.has(key)) {
        toDelete.push(r.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('call_node_responses')
        .delete()
        .in('id', toDelete);

      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Removed ${toDelete.length} duplicate responses`);
      }
    } else {
      console.log('  ✓ No duplicates found');
    }
  }

  console.log('\n✅ Cleanup complete!');

  // Show current counts
  console.log('\n📊 Current counts:');
  const { count: kpCount } = await supabase.from('call_node_keypoints').select('*', { count: 'exact', head: true });
  const { count: wCount } = await supabase.from('call_node_warnings').select('*', { count: 'exact', head: true });
  const { count: lfCount } = await supabase.from('call_node_listen_for').select('*', { count: 'exact', head: true });
  const { count: rCount } = await supabase.from('call_node_responses').select('*', { count: 'exact', head: true });

  console.log(`  - Keypoints: ${kpCount}`);
  console.log(`  - Warnings: ${wCount}`);
  console.log(`  - Listen For: ${lfCount}`);
  console.log(`  - Responses: ${rCount}`);
}

cleanupDuplicates();
