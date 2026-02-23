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

interface NodeDisplayProps {
  node: CallNode;
}

const nodeTypeConfig = {
  opening: {
    icon: Target,
    color: "primary",
    bgColor: "bg-secondary-light",
    borderColor: "border-primary-lighter/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    label: "Opening",
  },
  discovery: {
    icon: Search,
    color: "primary-light",
    bgColor: "bg-secondary-light",
    borderColor: "border-primary-light/30",
    iconBg: "bg-primary-light/10",
    iconColor: "text-primary-light",
    label: "Discovery",
  },
  pitch: {
    icon: Lightbulb,
    color: "primary-lighter",
    bgColor: "bg-secondary-light",
    borderColor: "border-primary-lighter/30",
    iconBg: "bg-primary-lighter/10",
    iconColor: "text-primary-lighter",
    label: "Pitch",
  },
  objection: {
    icon: AlertCircle,
    color: "red",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    label: "Objection",
  },
  close: {
    icon: Calendar,
    color: "primary-dark",
    bgColor: "bg-secondary-light",
    borderColor: "border-primary-dark/30",
    iconBg: "bg-primary-dark/10",
    iconColor: "text-primary-dark",
    label: "The Ask",
  },
  success: {
    icon: CheckCircle,
    color: "primary-lighter",
    bgColor: "bg-secondary-light",
    borderColor: "border-primary-lighter/30",
    iconBg: "bg-primary-lighter/10",
    iconColor: "text-primary-lighter",
    label: "Success",
  },
  end: {
    icon: XCircle,
    color: "primary-lighter",
    bgColor: "bg-secondary-light",
    borderColor: "border-primary-lighter/30",
    iconBg: "bg-primary-lighter/10",
    iconColor: "text-primary-lighter",
    label: "End Call",
  },
  voicemail: {
    icon: Voicemail,
    color: "primary-lighter",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    label: "Voicemail",
  },
};

export function NodeDisplay({ node }: NodeDisplayProps) {
  const { navigateTo, addObjection, metadata, scripts } = useCallStore();
  const { profile } = useAuth();
  const config = nodeTypeConfig[node.type];
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
            <h2 className="text-lg md:text-xl font-bold text-primary-dark">{node.title}</h2>
          </div>
        </div>
      </div>

      {/* Script Section */}
      <div className={`bg-white ${config.borderColor} border border-t-0 rounded-b-xl`}>
        <div className="p-4 md:p-6">
          {/* Main Script */}
          <div className="mb-4 md:mb-6">
            <h3 className="text-xs md:text-sm font-semibold text-[#502c85]/80 uppercase tracking-wider mb-2 md:mb-3">
              Say This:
            </h3>
            <div className="bg-primary-lighter rounded-lg p-3 md:p-4">
              <p className="text-base md:text-lg text-white whitespace-pre-line leading-relaxed font-bold italic">
                &ldquo;{processedScript}&rdquo;
              </p>
            </div>
          </div>

          {/* Context */}
          {node.context && (
            <div className="mb-4 md:mb-6">
              <div className="flex items-start gap-2 p-3 md:p-4 bg-[#502c85]/10 rounded-lg border border-[#502c85]/20">
                <Info className="h-4 w-4 md:h-5 md:w-5 text-[#502c85] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-[#502c85] mb-1">Context</h4>
                  <p className="text-xs md:text-sm text-[#502c85]">{node.context}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Points */}
          {node.keyPoints && node.keyPoints.length > 0 && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-xs md:text-sm font-semibold text-[#502c85]/80 uppercase tracking-wider mb-2">
                Key Points
              </h3>
              <ul className="space-y-1">
                {node.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs md:text-sm text-gray-700">
                    <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#502c85] flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Listen For */}
          {node.listenFor && node.listenFor.length > 0 && (
            <div className="mb-4 md:mb-6">
              <div className="flex items-start gap-2 p-3 md:p-4 bg-[#502c85]/10 rounded-lg border border-3 border-double border-[#502c85]/20">
                <Ear className="h-4 w-4 md:h-5 md:w-5 text-[#502c85] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-[#502c85] mb-2">Listen For</h4>
                  <ul className="space-y-1">
                    {node.listenFor.map((item, index) => (
                      <li key={index} className="text-xs md:text-sm text-[#502c85]">
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
              <div className="flex items-start gap-2 p-3 md:p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-red-900 mb-2">Avoid</h4>
                  <ul className="space-y-1">
                    {node.warnings.map((warning, index) => (
                      <li key={index} className="text-xs md:text-sm text-red-800">
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
              <div className="flex items-start gap-2 p-4 bg-[#502c85]/10 rounded-lg border border-3 border-double border-[#502c85]/20">
                <Info className="h-5 w-5 text-[#502c85] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-[#502c85] mb-1">Competitor Intel</h4>
                  <p className="text-sm text-[#502c85]">{node.metadata.competitorInfo}</p>
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

                  return (
                    <div key={index} className="relative group/response">
                      <button
                        onClick={() => handleResponseClick(response.nextNode, response.label)}
                        className="group w-full text-left p-3 md:p-4 rounded-lg border-2 border-dashed border-[#502c85]/80 hover:border-solid hover:bg-[#502c85]/80 active:bg-[#502c85] transition-all touch-manipulation"
                      >
                        <div className="flex items-start justify-between gap-2 md:gap-3">
                          <div>
                            <p className="font-medium text-sm md:text-base text-[#502c85]/80 group-hover:text-white group-active:text-white">
                              {response.label}
                            </p>
                            {response.note && (
                              <p className="text-xs md:text-sm text-[#502c85]/80 mt-1 group-hover:text-white group-active:text-white">
                                {response.note}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {context && (
                              <HelpCircle className="h-4 w-4 text-[#502c85]/40 group-hover:text-white/60 transition-colors" />
                            )}
                            <span className="text-gray-400 group-hover:text-white group-active:text-white text-lg md:text-xl">
                              →
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Context Tooltip */}
                      {context && (
                        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 p-3 bg-white text-gray-900 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-[#502c85]/10 opacity-0 group-hover/response:opacity-100 transition-all scale-95 group-hover/response:scale-100 pointer-events-none z-[100] min-w-[240px] max-w-sm">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 rounded-lg bg-[#502c85]/10">
                              <Info className="h-3.5 w-3.5 text-[#502c85]" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-bold text-[#502c85]/60 mb-1">
                                Strategy Hook
                              </p>
                              <p className="text-sm text-gray-700 leading-relaxed font-medium">
                                {context}
                              </p>
                            </div>
                          </div>
                          {/* Tooltip arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2">
                            <div className="border-[6px] border-transparent border-t-white drop-shadow-sm" />
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
                <GitFork className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-500" />
                <h3 className="text-xs md:text-sm font-semibold text-blue-600 uppercase tracking-wider">
                  My Custom Paths
                </h3>
              </div>
              <div className="grid gap-2 md:gap-3">
                {sandboxSidePaths.map((sbxNode) => (
                  <button
                    key={sbxNode.id}
                    onClick={() => navigateTo(sbxNode.id)}
                    className="group w-full text-left p-3 md:p-4 rounded-lg border-2 border-dashed border-blue-400/60 hover:border-solid hover:bg-blue-500/80 active:bg-blue-500 transition-all touch-manipulation"
                  >
                    <div className="flex items-start justify-between gap-2 md:gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 group-hover:bg-white/20 group-hover:text-white">
                            sandbox
                          </span>
                          <p className="font-medium text-sm md:text-base text-blue-700 group-hover:text-white">
                            {sbxNode.title}
                          </p>
                        </div>
                        {sbxNode.script && (
                          <p className="text-xs md:text-sm text-blue-600/70 mt-1 group-hover:text-white/80 line-clamp-2">
                            {sbxNode.script.slice(0, 100)}{sbxNode.script.length > 100 ? "..." : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-blue-400 group-hover:text-white text-lg md:text-xl">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End State */}
          {node.responses.length === 0 && sandboxSidePaths.length === 0 && (
            <div className="text-center py-4 md:py-6">
              <CheckCircle className="h-10 w-10 md:h-12 md:w-12 text-[#502c85] mx-auto mb-2 md:mb-3" />
              <p className="text-base md:text-lg font-medium text-gray-900">Call Complete</p>
              <p className="text-sm md:text-base text-gray-500 mt-1">
                Don&apos;t forget to copy the summary and update Penknife!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
