/**
 * Migration script to rename node IDs in the database to follow the new naming convention.
 *
 * Convention: {type_prefix}_{topic}_{qualifier}
 * Prefixes: opening_, disc_, pitch_, obj_, close_, success_, end_
 *
 * Usage: npx tsx scripts/migrate-node-ids.ts
 *
 * IMPORTANT: Run this ONCE after deploying the code changes.
 * This script updates all node IDs and their references across all tables.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Old ID -> New ID mapping
const idMapping: Record<string, string> = {
  "opening": "opening_general",
  "response_path_1": "disc_mostly_manual",
  "response_path_1_followup": "disc_ehr_followup",
  "response_path_2": "disc_some_automated",
  "response_path_2_followup": "disc_dms_followup",
  "response_path_3": "disc_all_automated",
  "response_path_3_challenge": "disc_automation_challenge",
  "response_path_3_pivot": "pitch_automation_pivot",
  "ehr_epic": "disc_ehr_epic",
  "ehr_other": "disc_ehr_other",
  "ehr_other_than": "disc_ehr_other_than",
  "onbase_path": "disc_onbase",
  "onbase_basic": "pitch_onbase_basic",
  "onbase_pitch": "pitch_onbase",
  "onbase_brainware": "disc_onbase_brainware",
  "brainware_dissatisfied": "pitch_brainware_dissatisfied",
  "brainware_satisfied": "disc_brainware_satisfied",
  "brainware_satisfied_pivot": "pitch_brainware_satisfied",
  "epic_gallery_path": "disc_gallery",
  "gallery_planning": "disc_gallery_planning",
  "gallery_pitch": "pitch_gallery",
  "gallery_using": "disc_gallery_using",
  "gallery_complement_pitch": "pitch_gallery_complement",
  "other_dms_path": "disc_other_dms",
  "other_dms_manual": "pitch_other_dms_manual",
  "other_dms_automated": "disc_other_dms_automated",
  "other_dms_probe_ai": "disc_other_dms_probe_ai",
  "other_dms_rule_based_pitch": "pitch_other_dms_rule_based",
  "other_dms_ai_pitch": "pitch_other_dms_ai",
  "epic_only_path": "disc_epic_only",
  "epic_only_pitch": "pitch_epic_only",
  "ehr_only_path": "disc_ehr_only",
  "ehr_only_pitch": "pitch_ehr_only",
  // pitch_full stays the same
  "the_ask": "close_ask_main",
  "the_ask_soft": "close_ask_soft",
  "meeting_set": "success_meeting_set",
  "objection_not_interested": "obj_not_interested",
  "objection_timing": "obj_timing",
  "objection_timing_followup": "close_timing_followup",
  "objection_happy_current": "obj_happy_current",
  "objection_happy_current_pivot": "pitch_happy_current_pivot",
  "objection_send_info": "obj_send_info",
  "objection_send_info_persistent": "obj_send_info_persistent",
  "objection_send_info_tentative": "close_send_info_tentative",
  "objection_not_decision_maker": "obj_not_decision_maker",
  "objection_include_others": "close_include_others",
  "objection_get_referral": "disc_get_referral",
  "objection_get_contacts": "close_get_contacts",
  "objection_cost": "obj_cost",
  "objection_cost_pushback": "obj_cost_pushback",
  "objection_no_budget": "obj_no_budget",
  "objection_budget_cycle": "close_budget_cycle",
  "objection_contract": "obj_contract",
  "objection_implementing": "obj_implementing",
  "objection_waiting_gallery": "obj_waiting_gallery",
  "objection_looking_competitor": "obj_looking_competitor",
  "objection_vendor_consolidation": "obj_vendor_consolidation",
  "objection_procurement": "obj_procurement",
  "objection_change_management": "obj_change_management",
  "objection_whats_this_about": "obj_whats_this_about",
  "satisfied_customer": "end_satisfied_customer",
  "call_end_success": "success_call_end",
  "call_end_info": "end_call_info",
  "call_end_followup": "end_call_followup",
  "call_end_no": "end_call_no",
  "voicemail": "end_voicemail",
};

async function migrate() {
  console.log("Starting node ID migration...");
  console.log(`Total mappings: ${Object.keys(idMapping).length}\n`);

  // Check which old IDs exist in the database
  const { data: existingNodes, error: fetchError } = await supabase
    .from("call_nodes")
    .select("id");

  if (fetchError) {
    console.error("Failed to fetch existing nodes:", fetchError);
    process.exit(1);
  }

  const existingIds = new Set(existingNodes?.map((n) => n.id) || []);
  console.log(`Found ${existingIds.size} nodes in database`);

  const applicableMappings = Object.entries(idMapping).filter(([oldId]) => existingIds.has(oldId));
  console.log(`Applicable mappings: ${applicableMappings.length}\n`);

  if (applicableMappings.length === 0) {
    console.log("No matching nodes found. Nothing to migrate.");
    return;
  }

  // ============================================================
  // PHASE 1: Create all new nodes (copies of old nodes with new IDs)
  // ============================================================
  console.log("=== PHASE 1: Creating new nodes ===");
  let phase1Errors = 0;
  const createdNewIds: string[] = [];

  for (const [oldId, newId] of applicableMappings) {
    const { data: nodeData, error: getError } = await supabase
      .from("call_nodes")
      .select("*")
      .eq("id", oldId)
      .single();

    if (getError || !nodeData) {
      console.error(`  FAIL: Could not fetch ${oldId}:`, getError?.message);
      phase1Errors++;
      continue;
    }

    // Insert copy with new ID
    const { error: insertError } = await supabase
      .from("call_nodes")
      .insert({ ...nodeData, id: newId });

    if (insertError) {
      console.error(`  FAIL: Could not insert ${newId}:`, insertError.message);
      phase1Errors++;
      continue;
    }

    console.log(`  OK: ${oldId} -> ${newId} (node created)`);
    createdNewIds.push(newId);
  }

  if (phase1Errors > 0) {
    console.error(`\nPhase 1 had ${phase1Errors} errors. Aborting to avoid partial migration.`);
    console.log("Cleaning up created nodes...");
    for (const newId of createdNewIds) {
      await supabase.from("call_nodes").delete().eq("id", newId);
    }
    process.exit(1);
  }

  // ============================================================
  // PHASE 2: Update all foreign key references to point to new IDs
  // ============================================================
  console.log("\n=== PHASE 2: Updating references ===");

  const childTables = [
    "call_node_keypoints",
    "call_node_warnings",
    "call_node_listen_for",
    "script_versions",
    "call_analytics",
  ];

  for (const [oldId, newId] of applicableMappings) {
    // Update node_id in child tables
    for (const table of childTables) {
      const { error: err } = await supabase
        .from(table)
        .update({ node_id: newId })
        .eq("node_id", oldId);

      if (err && !err.message.includes("does not exist")) {
        console.error(`  WARN: ${table}.node_id ${oldId} -> ${newId}: ${err.message}`);
      }
    }

    // Update call_node_responses.node_id (the owning node)
    const { error: respNodeErr } = await supabase
      .from("call_node_responses")
      .update({ node_id: newId })
      .eq("node_id", oldId);

    if (respNodeErr) {
      console.error(`  WARN: call_node_responses.node_id ${oldId} -> ${newId}: ${respNodeErr.message}`);
    }

    // Update call_node_responses.next_node_id (the target node)
    // Now safe because the new target node already exists from Phase 1
    const { error: respNextErr } = await supabase
      .from("call_node_responses")
      .update({ next_node_id: newId })
      .eq("next_node_id", oldId);

    if (respNextErr) {
      console.error(`  WARN: call_node_responses.next_node_id ${oldId} -> ${newId}: ${respNextErr.message}`);
    }

    console.log(`  OK: References updated for ${oldId} -> ${newId}`);
  }

  // ============================================================
  // PHASE 3: Delete old nodes (child records already point to new IDs)
  // ============================================================
  console.log("\n=== PHASE 3: Deleting old nodes ===");
  let deleteErrors = 0;

  for (const [oldId] of applicableMappings) {
    const { error: delError } = await supabase
      .from("call_nodes")
      .delete()
      .eq("id", oldId);

    if (delError) {
      console.error(`  FAIL: Could not delete ${oldId}: ${delError.message}`);
      deleteErrors++;
    } else {
      console.log(`  OK: Deleted ${oldId}`);
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n--- Migration Complete ---");
  console.log(`Nodes created: ${createdNewIds.length}`);
  console.log(`Delete errors: ${deleteErrors}`);
  console.log(`Skipped (not in DB): ${Object.keys(idMapping).length - applicableMappings.length}`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
