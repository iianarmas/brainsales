import {
  Play,
  Search,
  Server,
  Database,
  Lightbulb,
  Calendar,
  Flag,
  LucideIcon,
} from "lucide-react";

export interface TopicGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string; // Tailwind color name
  nodes: string[]; // Node IDs in this topic
}

export const topicGroups: TopicGroup[] = [
  {
    id: "opening",
    label: "Opening",
    icon: Play,
    color: "green",
    nodes: ["opening_general", "end_voicemail"],
  },
  {
    id: "discovery",
    label: "Discovery",
    icon: Search,
    color: "blue",
    nodes: [
      "disc_mostly_manual",
      "disc_some_automated",
      "disc_all_automated",
      "disc_ehr_followup",
    ],
  },
  {
    id: "ehr",
    label: "EHR",
    icon: Server,
    color: "cyan",
    nodes: ["disc_ehr_epic", "disc_ehr_other", "disc_epic_only", "disc_ehr_only"],
  },
  {
    id: "dms",
    label: "DMS",
    icon: Database,
    color: "purple",
    nodes: [
      "disc_onbase",
      "pitch_onbase_basic",
      "disc_onbase_brainware",
      "disc_gallery",
      "disc_gallery_planning",
      "disc_gallery_using",
      "pitch_gallery_complement",
      "disc_other_dms",
      "disc_other_dms_automated",
      "pitch_other_dms_ai",
    ],
  },
  {
    id: "pitch",
    label: "Pitch",
    icon: Lightbulb,
    color: "yellow",
    nodes: ["pitch_full", "pitch_onbase", "pitch_epic_only", "pitch_ehr_only"],
  },
  {
    id: "close",
    label: "Close",
    icon: Calendar,
    color: "orange",
    nodes: ["close_ask_main", "close_ask_soft", "success_meeting_set"],
  },
  {
    id: "end",
    label: "End",
    icon: Flag,
    color: "gray",
    nodes: [
      "success_call_end",
      "end_call_info",
      "end_call_followup",
      "end_call_no",
      "end_satisfied_customer",
    ],
  },
];

// Helper to find which topic a node belongs to
export function getTopicForNode(nodeId: string): TopicGroup | undefined {
  return topicGroups.find((topic) => topic.nodes.includes(nodeId));
}
