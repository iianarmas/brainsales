import {
  Play,
  Search,
  Server,
  Database,
  Users,
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
    nodes: ["opening", "voicemail"],
  },
  {
    id: "discovery",
    label: "Discovery",
    icon: Search,
    color: "blue",
    nodes: [
      "response_path_1",
      "response_path_2",
      "response_path_3",
      "response_path_1_followup",
    ],
  },
  {
    id: "ehr",
    label: "EHR",
    icon: Server,
    color: "cyan",
    nodes: ["ehr_epic", "ehr_other", "epic_only_path", "ehr_only_path"],
  },
  {
    id: "dms",
    label: "DMS",
    icon: Database,
    color: "purple",
    nodes: [
      "onbase_path",
      "onbase_basic",
      "onbase_brainware",
      "epic_gallery_path",
      "gallery_planning",
      "gallery_using",
      "gallery_complement_pitch",
      "other_dms_path",
      "other_dms_automated",
      "other_dms_ai_pitch",
    ],
  },
  {
    id: "competitors",
    label: "Competitors",
    icon: Users,
    color: "pink",
    nodes: [
      "brainware_dissatisfied",
      "brainware_satisfied",
      "brainware_satisfied_pivot",
    ],
  },
  {
    id: "pitch",
    label: "Pitch",
    icon: Lightbulb,
    color: "yellow",
    nodes: ["pitch_full", "onbase_pitch", "epic_only_pitch", "ehr_only_pitch"],
  },
  {
    id: "close",
    label: "Close",
    icon: Calendar,
    color: "orange",
    nodes: ["the_ask", "the_ask_soft", "meeting_set"],
  },
  {
    id: "end",
    label: "End",
    icon: Flag,
    color: "gray",
    nodes: [
      "call_end_success",
      "call_end_info",
      "call_end_followup",
      "call_end_no",
      "satisfied_customer",
    ],
  },
];

// Helper to find which topic a node belongs to
export function getTopicForNode(nodeId: string): TopicGroup | undefined {
  return topicGroups.find((topic) => topic.nodes.includes(nodeId));
}
