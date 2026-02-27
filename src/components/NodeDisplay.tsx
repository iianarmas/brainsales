"use client";

import { CallNode } from "@/data/callFlow";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/context/AuthContext";
import { replaceScriptPlaceholders } from "@/utils/replaceScriptPlaceholders";
import {
  Target,
  Search,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Info,
  AlertTriangle,
  Ear,
  GitFork,
  Voicemail,
  HelpCircle,
} from "lucide-react";
import { TypewriterText } from "./TypewriterText";
import { Tooltip } from "./Tooltip";

interface NodeDisplayProps {
  node: CallNode;
}

const nodeTypeConfig = {
  opening: {
    icon: Target,
    color: "primary",
    bgColor: "bg-primary/5", // Was bg-secondary, now uses a subtle hint of the app theme
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-primary",
    sayThisGradient: "from-primary to-primary-light",
    label: "Opening",
  },
  discovery: {
    icon: Search,
    color: "primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-primary",
    sayThisGradient: "from-primary to-primary-light",
    label: "Discovery",
  },
  pitch: {
    icon: Lightbulb,
    color: "primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-primary",
    sayThisGradient: "from-primary to-primary-light",
    label: "Pitch",
  },
  objection: {
    icon: AlertCircle,
    color: "primary", // Inherit primary app theme for icon instead of hardcoded red
    bgColor: "bg-primary/5", // Keep subtle background matching user theme
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-red-600", // Keep the "Say This" block specifically red for objection warnings
    sayThisGradient: "from-red-600 to-red-500/80",
    label: "Objection",
  },
  close: {
    icon: Calendar,
    color: "primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-primary",
    sayThisGradient: "from-primary to-primary-light",
    label: "The Ask",
  },
  success: {
    icon: CheckCircle,
    color: "primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-primary",
    sayThisGradient: "from-primary to-primary-light",
    label: "Success",
  },
  end: {
    icon: XCircle,
    color: "primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-gray-600",
    sayThisGradient: "from-gray-600 to-gray-500/80",
    label: "End Call",
  },
  voicemail: {
    icon: Voicemail,
    color: "primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    sayThisBg: "bg-primary",
    sayThisGradient: "from-primary to-primary-light",
    label: "Voicemail",
  },
};

export function NodeDisplay({ node }: NodeDisplayProps) {
  const { navigateTo, addObjection, metadata, scripts, aiRecommendation } = useCallStore();
  const { profile } = useAuth();

  // Default to discovery if type is unexpectedly missing
  const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig] || nodeTypeConfig.discovery;
  const Icon = config.icon;

  // Find sandbox side-path nodes forked from this node
  const sandboxSidePaths = Object.values(scripts).filter(
    (n) => n.scope === "sandbox" && n.forked_from_node_id === node.id
  );

  // Replace placeholders in script
  const processedScript = replaceScriptPlaceholders(node.script, profile, metadata);

  const handleResponseClick = (nextNode: string, label: string) => {
    // Track objections
    if (label.toLowerCase().includes("not interested")) {
      addObjection("Not Interested");
    } else if (label.toLowerCase().includes("send") && label.toLowerCase().includes("info")) {
      addObjection("Send Info");
    } else if (label.toLowerCase().includes("budget")) {
      addObjection("No Budget");
    } else if (label.toLowerCase().includes("decision maker")) {
      addObjection("Not Decision Maker");
    }

    navigateTo(nextNode);
  };

  return (
    <div className="max-w-4xl mx-auto px-2 md:px-0">
      {/* Node Header */}
      <div className={`rounded-t-xl ${config.bgColor} ${config.borderColor} border border-b-0 p-3 md:p-4`}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`p-1.5 md:p-2 rounded-lg ${config.iconBg}`}>
            <Icon className={`h-4 w-4 md:h-5 md:w-5 ${config.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider ${config.iconColor}`}>
                {config.label}
              </span>
              {node.scope === "sandbox" && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 uppercase">
                  My Custom
                </span>
              )}
            </div>
            <h2 className="text-lg md:text-xl font-bold text-foreground">{node.title}</h2>
          </div>
        </div>
      </div>

      {/* Script Section */}
      <div className={`bg-background ${config.borderColor} border border-t-0 rounded-b-xl transition-colors`}>
        <div className="p-4 md:p-6">
          {/* Main Script */}
          <div className="mb-4 md:mb-6">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wider">
                Say This:
              </h3>
            </div>
            <div className={`${config.sayThisBg} bg-gradient-to-br ${config.sayThisGradient} rounded-xl p-4 md:p-6 shadow-inner ring-1 ring-white/10 relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative z-10 text-white">
                <TypewriterText
                  text={processedScript}
                  nodeId={node.id}
                  speed={33}
                  className="text-lg md:text-2xl text-white whitespace-pre-line leading-relaxed font-mono font-medium drop-shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Context */}
          {node.context && (
            <div className="mb-4 md:mb-6">
              <div className="flex items-start gap-2 p-3 md:p-4 bg-primary/10 rounded-lg border border-primary/20">
                <Info className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-primary mb-1">Context</h4>
                  <p className="text-xs md:text-sm text-primary">{node.context}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Points */}
          {node.keyPoints && node.keyPoints.length > 0 && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-xs md:text-sm font-semibold text-primary/80 uppercase tracking-wider mb-2">
                Key Points
              </h3>
              <ul className="space-y-1">
                {node.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs md:text-sm text-foreground/80 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Listen For */}
          {node.listenFor && node.listenFor.length > 0 && (
            <div className="mb-4 md:mb-6">
              <div className="flex items-start gap-2 p-3 md:p-4 bg-primary/10 rounded-lg border-3 border-double border-primary/20">
                <Ear className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-primary mb-2">Listen For</h4>
                  <ul className="space-y-1">
                    {node.listenFor.map((item, index) => (
                      <li key={index} className="text-xs md:text-sm text-primary">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {node.warnings && node.warnings.length > 0 && (
            <div className="mb-4 md:mb-6">
              <div className="flex items-start gap-2 p-3 md:p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-destructive-foreground mb-2">Avoid</h4>
                  <ul className="space-y-1">
                    {node.warnings.map((warning, index) => (
                      <li key={index} className="text-xs md:text-sm text-destructive-foreground/90">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Competitor Info */}
          {node.metadata?.competitorInfo && (
            <div className="mb-6">
              <div className="flex items-start gap-2 p-4 bg-primary/10 rounded-lg border-3 border-double border-primary/20">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-primary mb-1">Competitor Intel</h4>
                  <p className="text-sm text-primary">{node.metadata.competitorInfo}</p>
                </div>
              </div>
            </div>
          )}

          {/* Response Buttons */}
          {node.responses.length > 0 && (
            <div>
              <h3 className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wider mb-2 md:mb-3">
                Prospect Response:
              </h3>
              <div className="grid gap-2 md:gap-3">
                {node.responses.map((response, index) => {
                  const targetNode = scripts[response.nextNode];
                  const context = targetNode?.context;
                  const isAIRecommended = aiRecommendation?.recommendedNodeId === response.nextNode;
                  const aiConfidence = isAIRecommended ? aiRecommendation?.confidence : null;

                  // Glow ring classes by confidence
                  const glowClass = isAIRecommended
                    ? aiConfidence === "high"
                      ? "ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.55)] animate-pulse border-solid border-emerald-400/60"
                      : aiConfidence === "medium"
                        ? "ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)] border-solid border-amber-400/60"
                        : ""
                    : "";

                  const isClickable = !response.isSpecialInstruction || !!response.nextNode;
                  const CardComponent = isClickable ? 'button' : 'div';

                  return (
                    <div key={index} className="relative group/response">
                      <CardComponent
                        onClick={isClickable ? () => handleResponseClick(response.nextNode, response.label) : undefined}
                        className={`group w-full text-left p-3 md:p-4 rounded-lg transition-all border-2 ${response.isSpecialInstruction
                          ? "bg-instruction/10 border-instruction/40"
                          : `border-dashed border-primary hover:border-solid hover:bg-primary active:bg-primary/90 ${glowClass}`
                          } ${isClickable ? "touch-manipulation" : "cursor-default"}`}
                      >
                        <div className="flex items-start justify-between gap-2 md:gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-semibold text-sm md:text-base ${response.isSpecialInstruction
                                ? "text-instruction-foreground"
                                : "text-primary group-hover:text-primary-foreground group-active:text-primary-foreground"
                                }`}>
                                {response.label}
                              </p>
                              {response.isSpecialInstruction && (
                                <span className="flex items-center gap-0.5 px-1 bg-instruction/10 text-instruction-foreground text-[9px] font-bold rounded uppercase tracking-wider border border-instruction/20">
                                  Instruction
                                </span>
                              )}
                            </div>
                            {response.note && (
                              <p className={`text-xs md:text-sm ${response.isSpecialInstruction
                                ? "text-instruction-foreground/90 italic"
                                : "text-foreground group-hover:text-primary-foreground group-active:text-primary-foreground opacity-70 group-hover:opacity-100 transition-opacity"
                                }`}>
                                {response.note}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {context && (
                              <HelpCircle className="h-4 w-4 text-primary group-hover:text-primary-foreground/80 transition-colors" />
                            )}
                            {isClickable && !response.isSpecialInstruction && (
                              <span className="text-primary group-hover:text-primary-foreground group-active:text-primary-foreground text-lg md:text-xl transition-colors">
                                →
                              </span>
                            )}
                          </div>
                        </div>
                      </CardComponent>

                      {/* Strategy Hook Tooltip */}
                      {context && (
                        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 p-3 bg-background text-foreground rounded-xl shadow-[0_4px_20px_rgba(var(--primary-rgb),0.15)] border border-primary/20 opacity-0 group-hover/response:opacity-100 transition-all scale-95 group-hover/response:scale-100 pointer-events-none z-[100] min-w-[240px] max-w-sm">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 rounded-lg bg-primary/10">
                              <Info className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1">
                                Strategy Hook
                              </p>
                              <p className="text-sm text-foreground leading-relaxed font-medium">
                                {context}
                              </p>
                            </div>
                          </div>
                          {/* Tooltip arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2">
                            <div className="border-[6px] border-transparent border-t-background drop-shadow-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sandbox Side Paths - personal custom alternatives forked from this node */}
          {sandboxSidePaths.length > 0 && (
            <div className="mt-4 md:mt-6">
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <GitFork className="h-3.5 w-3.5 md:h-4 md:w-4 text-info" />
                <h3 className="text-xs md:text-sm font-semibold text-info uppercase tracking-wider">
                  My Custom Paths
                </h3>
              </div>
              <div className="grid gap-2 md:gap-3">
                {sandboxSidePaths.map((sbxNode) => (
                  <button
                    key={sbxNode.id}
                    onClick={() => navigateTo(sbxNode.id)}
                    className="group w-full text-left p-3 md:p-4 rounded-lg border-2 border-dashed border-info/60 hover:border-solid hover:bg-info active:bg-info transition-all touch-manipulation"
                  >
                    <div className="flex items-start justify-between gap-2 md:gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/10 text-info-foreground group-hover:bg-white/20 group-hover:text-white border border-info/20 transition-colors">
                            sandbox
                          </span>
                          <p className="font-medium text-sm md:text-base text-info-foreground group-hover:text-white transition-colors">
                            {sbxNode.title}
                          </p>
                        </div>
                        {sbxNode.script && (
                          <p className="text-xs md:text-sm text-info-foreground/70 mt-1 group-hover:text-white/80 line-clamp-2 transition-colors">
                            {sbxNode.script.slice(0, 100)}{sbxNode.script.length > 100 ? "..." : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-info-foreground group-hover:text-white text-lg md:text-xl">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {node.responses.length === 0 && sandboxSidePaths.length === 0 && (
            <div className="text-center py-4 md:py-6">
              <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-primary mx-auto mb-2 md:mb-3" />
              <p className="text-base md:text-lg font-medium text-foreground">Call Complete</p>
              <p className="text-sm md:text-base text-foreground/50 mt-1 transition-colors">
                Don't forget to copy the summary and update Penknife!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
