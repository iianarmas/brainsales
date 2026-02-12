"use client";

import React, { useState } from "react";
import { X, Sparkles, Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { CallNode } from "@/data/callFlow";

interface AIScriptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (nodes: CallNode[]) => void;
  session: { access_token: string } | null;
  productId?: string;
}

type Step = "input" | "generating" | "preview";

const NODE_TYPE_COLORS: Record<string, string> = {
  opening: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  discovery: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  pitch: "bg-green-500/20 text-green-400 border-green-500/30",
  objection: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  close: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  voicemail: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  end: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AIScriptGeneratorModal({
  isOpen,
  onClose,
  onApprove,
  session,
  productId,
}: AIScriptGeneratorModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [productDescription, setProductDescription] = useState("");
  const [targetPersona, setTargetPersona] = useState("");
  const [commonObjections, setCommonObjections] = useState("");
  const [generatedNodes, setGeneratedNodes] = useState<CallNode[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const resetState = () => {
    setStep("input");
    setProductDescription("");
    setTargetPersona("");
    setCommonObjections("");
    setGeneratedNodes([]);
    setWarnings([]);
    setError(null);
    setExpandedNodes(new Set());
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleGenerate = async () => {
    if (!session?.access_token) return;

    setStep("generating");
    setError(null);

    try {
      const response = await fetch("/api/ai/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({
          productDescription,
          targetPersona,
          commonObjections,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await response.json();
      setGeneratedNodes(data.nodes);
      setWarnings(data.warnings || []);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("input");
    }
  };

  const handleApprove = () => {
    onApprove(generatedNodes);
    handleClose();
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedNodes(new Set(generatedNodes.map((n) => n.id)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  if (!isOpen) return null;

  // Count nodes by type
  const typeCounts = generatedNodes.reduce(
    (acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-primary-light/30 rounded-xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-primary-light/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI Script Generator</h2>
              <p className="text-sm text-muted-foreground">
                {step === "input" && "Describe your product and persona to generate a call flow"}
                {step === "generating" && "Generating your script..."}
                {step === "preview" && `Generated ${generatedNodes.length} nodes - review before importing`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Input Step */}
          {step === "input" && (
            <div className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Product / Service Description *
                </label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="e.g., We sell an AI-powered document processing platform for healthcare organizations. Our system (DextractLM) automatically classifies, extracts, and indexes medical documents, reducing manual HIM work by 70-80%."
                  className="w-full h-28 px-3 py-2 bg-muted/50 border border-primary-light/30 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Target Persona *
                </label>
                <textarea
                  value={targetPersona}
                  onChange={(e) => setTargetPersona(e.target.value)}
                  placeholder="e.g., HIM Directors and Managers at mid-to-large hospitals (200+ beds). They manage document processing teams, deal with high fax volumes, and are often frustrated with manual indexing workflows."
                  className="w-full h-24 px-3 py-2 bg-muted/50 border border-primary-light/30 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Common Objections
                </label>
                <textarea
                  value={commonObjections}
                  onChange={(e) => setCommonObjections(e.target.value)}
                  placeholder='e.g., "We already use OnBase", "Epic is pushing us to Gallery", "We just renewed our contract", "We don&#39;t have budget this year"'
                  className="w-full h-24 px-3 py-2 bg-muted/50 border border-primary-light/30 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional. If left blank, standard sales objections will be used.
                </p>
              </div>
            </div>
          )}

          {/* Generating Step */}
          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1" />
              </div>
              <div className="text-center">
                <p className="text-foreground font-medium">Generating your call flow...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Claude is crafting a multi-branching script. This may take 15-30 seconds.
                </p>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm font-medium text-yellow-400 mb-1">Warnings</p>
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-400/80">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeCounts).map(([type, count]) => (
                  <span
                    key={type}
                    className={`px-2 py-1 text-xs rounded-md border ${NODE_TYPE_COLORS[type] || "bg-muted text-foreground"}`}
                  >
                    {type}: {count}
                  </span>
                ))}
              </div>

              {/* Expand/Collapse controls */}
              <div className="flex gap-2">
                <button onClick={expandAll} className="text-xs text-primary hover:underline">
                  Expand all
                </button>
                <span className="text-xs text-muted-foreground">|</span>
                <button onClick={collapseAll} className="text-xs text-primary hover:underline">
                  Collapse all
                </button>
              </div>

              {/* Node list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {generatedNodes.map((node) => {
                  const isExpanded = expandedNodes.has(node.id);
                  return (
                    <div
                      key={node.id}
                      className="border border-primary-light/20 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleNode(node.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span
                          className={`px-1.5 py-0.5 text-[10px] rounded border ${NODE_TYPE_COLORS[node.type] || "bg-muted"}`}
                        >
                          {node.type}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate">
                          {node.title}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {node.responses?.length || 0} paths
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-primary-light/10 space-y-2">
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{node.script}</p>
                          {node.context && (
                            <p className="text-xs text-muted-foreground italic">{node.context}</p>
                          )}
                          {node.responses && node.responses.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Responses:</p>
                              {node.responses.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                                  <span className="text-primary">→</span>
                                  <span>{r.label}</span>
                                  <span className="text-muted-foreground">→ {r.nextNode}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-primary-light/20">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {step === "input" && (
              <button
                onClick={handleGenerate}
                disabled={!productDescription.trim() || !targetPersona.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                Generate Script
              </button>
            )}

            {step === "preview" && (
              <>
                <button
                  onClick={() => setStep("input")}
                  className="px-4 py-2 text-sm border border-primary-light/30 text-foreground rounded-lg hover:bg-muted/50 transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Import {generatedNodes.length} Nodes
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
