"use client";

import React, { useState, useEffect } from "react";
import { Search, User, ArrowUp, Loader2, Library } from "lucide-react";
import { toast } from "sonner";
import { CallNode, NodeType } from "@/data/callFlow";
import { Session } from "@supabase/supabase-js";

interface CommunityLibraryViewProps {
  productId?: string;
  session: Session | null;
  isAdmin: boolean;
  onNodeSelect: (node: CallNode) => void;
}

const typeColors: Record<string, string> = {
  opening: "bg-green-500/20 text-green-500 border-green-500/30",
  discovery: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  pitch: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  objection: "bg-red-500/20 text-red-500 border-red-500/30",
  close: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  success: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  end: "bg-gray-500/20 text-gray-500 border-gray-500/30",
};

export default function CommunityLibraryView({
  productId,
  session,
  isAdmin,
  onNodeSelect,
}: CommunityLibraryViewProps) {
  const [nodes, setNodes] = useState<(CallNode & { published_at?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [promotingId, setPromotingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCommunityNodes() {
      if (!session?.access_token) return;

      try {
        setLoading(true);
        const headers: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (productId) headers["X-Product-Id"] = productId;

        const response = await fetch("/api/scripts/community/nodes", { headers });
        if (!response.ok) throw new Error("Failed to fetch community nodes");

        const data = await response.json();
        setNodes(data);
      } catch (err) {
        console.error("Error fetching community nodes:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCommunityNodes();
  }, [session?.access_token, productId]);

  const handlePromote = async (nodeId: string) => {
    if (!session?.access_token) return;
    setPromotingId(nodeId);
    try {
      const response = await fetch("/api/scripts/community/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ nodeId }),
      });
      if (!response.ok) throw new Error("Failed to promote");
      toast.success("Node promoted to official flow!");
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    } catch (err) {
      toast.error("Failed to promote node");
    } finally {
      setPromotingId(null);
    }
  };

  const filteredNodes = nodes.filter((node) => {
    const matchesSearch =
      !searchTerm ||
      node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.script.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.creator_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || node.type === filterType;
    return matchesSearch && matchesType;
  });

  const nodeTypes: NodeType[] = ["opening", "discovery", "pitch", "objection", "close", "success", "end"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Search and filter bar */}
      <div className="p-4 border-b border-primary-light/20 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, script, or creator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-primary-light/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterType === "all" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {nodeTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                filterType === type ? "bg-primary text-white" : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Node cards grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Library className="h-12 w-12 opacity-40" />
            <p className="text-sm">
              {nodes.length === 0 ? "No community nodes yet" : "No matching nodes found"}
            </p>
            <p className="text-xs">
              {nodes.length === 0
                ? "Users can publish nodes from their sandbox here"
                : "Try adjusting your search or filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNodes.map((node) => (
              <div
                key={node.id}
                className="bg-background border border-primary-light/20 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onNodeSelect(node)}
              >
                {/* Type header */}
                <div className={`px-3 py-1.5 ${typeColors[node.type] || typeColors.discovery} border-b`}>
                  <span className="text-xs font-semibold uppercase">{node.type}</span>
                </div>

                {/* Content */}
                <div className="p-3 space-y-2">
                  <h3 className="font-semibold text-sm line-clamp-1">{node.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-3">{node.script}</p>

                  {/* Metadata badges */}
                  <div className="flex flex-wrap gap-1">
                    {node.responses.length > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                        {node.responses.length} responses
                      </span>
                    )}
                    {node.keyPoints && node.keyPoints.length > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {node.keyPoints.length} key points
                      </span>
                    )}
                  </div>

                  {/* Creator info */}
                  <div className="flex items-center justify-between pt-2 border-t border-primary-light/20">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {node.creator_avatar_url ? (
                        <img src={node.creator_avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                      <span>{node.creator_name || "Unknown"}</span>
                    </div>

                    {/* Admin promote button */}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromote(node.id);
                        }}
                        disabled={promotingId === node.id}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {promotingId === node.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )}
                        Promote
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
