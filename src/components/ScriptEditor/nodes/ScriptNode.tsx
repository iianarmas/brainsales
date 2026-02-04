"use client";

import React, { memo } from "react";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import {
  Target,
  Search,
  Lightbulb,
  AlertCircle,
  Calendar,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  User,
  Voicemail,
} from "lucide-react";
import { CallNode } from "@/data/callFlow";

interface ScriptNodeData extends Record<string, unknown> {
  callNode: CallNode;
  topicGroupId: string | null;
  onDelete?: (id: string, title: string) => void;
  isHighlighted?: boolean;
}

type ScriptNodeType = Node<ScriptNodeData>;

const nodeTypeConfig = {
  opening: {
    icon: Target,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  discovery: {
    icon: Search,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  pitch: {
    icon: Lightbulb,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  objection: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  close: {
    icon: Calendar,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  success: {
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  voicemail: {
    icon: Voicemail,
    color: "text-teal-600",
    bgColor: "bg-teal-600/10",
    borderColor: "border-teal-600/30",
  },
  end: {
    icon: XCircle,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
  },
};

function ScriptNode({ data, selected }: NodeProps<ScriptNodeType>) {
  const { callNode, onDelete } = data;
  const config = nodeTypeConfig[callNode.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.discovery;
  const Icon = config.icon;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent node selection
    if (onDelete) {
      onDelete(callNode.id, callNode.title || "Untitled Node");
    }
  };

  return (
    <div
      className={`
        relative bg-background border-2 rounded-lg shadow-lg transition-all min-w-[250px] max-w-[300px]
        ${selected ? "border-primary shadow-primary/20 scale-105 z-10" :
          data.isHighlighted ? "border-yellow-400 shadow-yellow-400/30 animate-pulse scale-105 z-10" :
            config.borderColor}
      `}
    >
      {/* Target handle (top) - for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {/* Header */}
      <div className={`px-3 py-2 ${config.bgColor}`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className={`text-xs font-semibold uppercase ${config.color}`}>
            {callNode.type}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2">{callNode.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {callNode.script.substring(0, 80)}
          {callNode.script.length > 80 ? "..." : ""}
        </p>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-1">
          {callNode.keyPoints && callNode.keyPoints.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {callNode.keyPoints.length} key points
            </span>
          )}
          {callNode.warnings && callNode.warnings.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 border border-red-500/20">
              {callNode.warnings.length} warnings
            </span>
          )}
          {callNode.listenFor && callNode.listenFor.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-500 border border-purple-500/20">
              {callNode.listenFor.length} listen for
            </span>
          )}
        </div>

        {/* Response count */}
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-gray-500/50">
          {callNode.responses.length} response{callNode.responses.length !== 1 ? "s" : ""}
        </div>

        {/* Creator name badge (sandbox/community nodes) */}
        {callNode.creator_name && callNode.scope && callNode.scope !== "official" && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1">
            {callNode.creator_avatar_url ? (
              <img src={callNode.creator_avatar_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
            ) : (
              <User className="h-3 w-3" />
            )}
            <span>{callNode.creator_name}</span>
          </div>
        )}
      </div>

      {/* Source handles (bottom) - for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {/* Hover actions */}
      {selected && (
        <div className="absolute -top-3 -right-3 flex gap-1">
          <button
            className="p-1.5 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform"
            title="Edit node"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            className="p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
            title="Delete node"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ScriptNode);
