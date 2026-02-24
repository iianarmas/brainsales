import {
  Play,
  Search,
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
    nodes: ["opening_default"],
  },
  {
    id: "discovery",
    label: "Discovery",
    icon: Search,
    color: "blue",
    nodes: ["discovery_default"],
  },
  {
    id: "pitch",
    label: "Pitch",
    icon: Lightbulb,
    color: "yellow",
    nodes: ["pitch_default"],
  },
  {
    id: "close",
    label: "Close",
    icon: Calendar,
    color: "orange",
    nodes: ["close_default"],
  },
  {
    id: "end",
    label: "End",
    icon: Flag,
    color: "gray",
    nodes: ["end_success", "end_not_interested"],
  },
];

// Helper to find which topic a node belongs to
export function getTopicForNode(nodeId: string): TopicGroup | undefined {
  return topicGroups.find((topic) => topic.nodes.includes(nodeId));
}
