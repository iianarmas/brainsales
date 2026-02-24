export type NodeType =
  | "opening"
  | "discovery"
  | "pitch"
  | "objection"
  | "close"
  | "success"
  | "voicemail"
  | "end";

export interface Response {
  label: string;
  nextNode: string;
  note?: string;
  isSpecialInstruction?: boolean;
}

export type NodeScope = 'official' | 'sandbox' | 'community';

export interface CallNode {
  id: string;
  type: NodeType;
  title: string;
  script: string;
  context?: string;
  keyPoints?: string[];
  warnings?: string[];
  listenFor?: string[];
  responses: Response[];
  topic_group_id?: string | null;
  call_flow_ids?: string[] | null;
  scope?: NodeScope;
  owner_user_id?: string;
  creator_name?: string;
  creator_avatar_url?: string;
  forked_from_node_id?: string;
  published_at?: string;
  metadata?: {
    competitorInfo?: string;
    greenFlags?: string[];
    redFlags?: string[];
    outcome?: "meeting_set" | "follow_up" | "send_info" | "not_interested" | null;
    meetingSubject?: string;
    meetingBody?: string;
    ehr?: string;
    dms?: string;
    competitors?: string[];
    environmentTriggers?: Record<string, string | string[]>;
    // AI Companion Configuration
    aiIntent?: string;
    aiTransitionTriggers?: Array<{
      condition: string;
      targetNodeId: string;
      confidence: "high" | "medium";
    }>;
  };
}

/** Check if a node belongs to the active call flow.
 *  Returns true if the node is universal (null/empty call_flow_ids) or matches the active flow. */
export function isNodeInFlow(node: CallNode, activeFlowId: string | null): boolean {
  if (!activeFlowId) return true;
  if (!node.call_flow_ids || node.call_flow_ids.length === 0) return true;
  return node.call_flow_ids.includes(activeFlowId);
}

export const callFlow: Record<string, CallNode> = {
  // ===== GENERIC PLACEHOLDERS FOR NEW ORGANIZATIONS =====
  opening_default: {
    id: "opening_default",
    type: "opening",
    title: "Default Opening",
    script: "Hi [Name], this is [Your Name] from [Organization]. How are you doing today?",
    context: "Set the tone for the call and establish initial rapport.",
    responses: [
      {
        label: "Proceed to Discovery",
        nextNode: "discovery_default",
      }
    ]
  },

  discovery_default: {
    id: "discovery_default",
    type: "discovery",
    title: "Default Discovery",
    script: "I wanted to learn more about how you currently handle [Process]. What are your biggest challenges right now?",
    context: "Understand the prospect's needs and current situation.",
    responses: [
      {
        label: "Proceed to Pitch",
        nextNode: "pitch_default",
      }
    ]
  },

  pitch_default: {
    id: "pitch_default",
    type: "pitch",
    title: "Default Pitch",
    script: "Based on what you've shared, I think we can help. [Organization] provides a solution that addresses [Pains] by [Values].",
    context: "Present your value proposition tailored to their discovery answers.",
    responses: [
      {
        label: "Closing / Next Steps",
        nextNode: "close_default",
      }
    ]
  },

  close_default: {
    id: "close_default",
    type: "close",
    title: "Default Close",
    script: "Does it make sense to schedule a follow-up meeting to dive deeper into how this could work for you?",
    context: "Secure a definitive next step or commitment.",
    responses: [
      {
        label: "Success / Meeting Set",
        nextNode: "end_success",
      },
      {
        label: "Not Interested",
        nextNode: "end_not_interested",
      }
    ]
  },

  end_success: {
    id: "end_success",
    type: "success",
    title: "Meeting Scheduled",
    script: "Great, I've sent over the calendar invite. Looking forward to our next conversation!",
    responses: []
  },

  end_not_interested: {
    id: "end_not_interested",
    type: "end",
    title: "Not Interested",
    script: "No problem at all. Thanks for taking the time to speak with me today. Have a great day!",
    responses: []
  }
};
