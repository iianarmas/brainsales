"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Link2,
  Plus,
  Trash2,
  Play,
  Search,
  Lightbulb,
  AlertCircle,
  Calendar,
  CheckCircle,
  XCircle,
  LucideIcon,
} from "lucide-react";
import { TreeItem } from "./useTreeData";

const typeConfig: Record<
  string,
  { icon: LucideIcon; color: string; bg: string }
> = {
  opening: { icon: Play, color: "text-green-500", bg: "bg-green-500/10" },
  discovery: { icon: Search, color: "text-blue-500", bg: "bg-blue-500/10" },
  pitch: { icon: Lightbulb, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  objection: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  close: { icon: Calendar, color: "text-orange-500", bg: "bg-orange-500/10" },
  success: {
    icon: CheckCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  end: { icon: XCircle, color: "text-gray-400", bg: "bg-gray-500/10" },
};

interface TreeNodeItemProps {
  item: TreeItem;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  matchesSearch: boolean;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  expandedIds: Set<string>;
  selectedNodeId: string | null;
  searchMatchIds: Set<string>;
  isReadOnly?: boolean;
}

export default function TreeNodeItem({
  item,
  depth,
  isExpanded,
  isSelected,
  matchesSearch,
  onToggle,
  onSelect,
  onAddChild,
  onDelete,
  expandedIds,
  selectedNodeId,
  searchMatchIds,
  isReadOnly = false,
}: TreeNodeItemProps) {
  const { node, children, isLink, responseLabel } = item;
  const config = typeConfig[node.type] || typeConfig.end;
  const Icon = config.icon;
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer group transition-colors ${isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-gray-100 border border-transparent"
          } ${isLink ? "opacity-70" : ""}`}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/collapse chevron */}
        <button
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${!hasChildren || isLink ? "invisible" : ""
            }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          )}
        </button>

        {/* Type icon */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${config.bg}`}
        >
          {isLink ? (
            <Link2 className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
          )}
        </div>

        {/* Title and response label */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {responseLabel && (
            <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {responseLabel}
            </span>
          )}
          <span
            className={`text-sm truncate ${isLink ? "italic text-gray-400" : "text-gray-800"
              } ${matchesSearch ? "bg-yellow-100 rounded px-0.5" : ""}`}
          >
            {node.title}
          </span>
        </div>

        {/* Response count badge */}
        {node.responses.length > 0 && (
          <span className="flex-shrink-0 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
            {node.responses.length}
          </span>
        )}

        {/* Link indicator */}
        {isLink && (
          <span className="flex-shrink-0 text-[10px] text-gray-400" title="Referenced from another branch">
            ref
          </span>
        )}

        {/* Add child button */}
        {!isReadOnly && (
          <button
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            title="Add child node"
          >
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}

        {/* Delete button */}
        {!isReadOnly && (
          <button
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            title="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>

      {/* Render children recursively */}
      {isExpanded && !isLink && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNodeItem
              key={`${node.id}-${child.node.id}-${child.responseLabel}`}
              item={child}
              depth={depth + 1}
              isExpanded={expandedIds.has(child.node.id)}
              isSelected={selectedNodeId === child.node.id}
              matchesSearch={searchMatchIds.has(child.node.id)}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              searchMatchIds={searchMatchIds}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
