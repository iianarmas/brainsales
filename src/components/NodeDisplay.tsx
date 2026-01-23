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
};

export function NodeDisplay({ node }: NodeDisplayProps) {
  const { navigateTo, addObjection, metadata } = useCallStore();
  const { profile } = useAuth();
  const config = nodeTypeConfig[node.type];
  const Icon = config.icon;

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
    <div className="max-w-4xl mx-auto">
      {/* Node Header */}
      <div className={`rounded-t-xl ${config.bgColor} ${config.borderColor} border border-b-0 p-4`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.iconBg}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div>
            <span className={`text-xs font-semibold uppercase tracking-wider ${config.iconColor}`}>
              {config.label}
            </span>
            <h2 className="text-xl font-bold text-primary-dark">{node.title}</h2>
          </div>
        </div>
      </div>

      {/* Script Section */}
      <div className={`bg-white ${config.borderColor} border border-t-0 rounded-b-xl`}>
        <div className="p-6">
          {/* Main Script */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#502c85]/80 uppercase tracking-wider mb-3">
              Say This:
            </h3>
            <div className="bg-primary-lighter rounded-lg p-4">
              <p className="text-lg text-white whitespace-pre-line leading-relaxed font-bold italic">
                &ldquo;{processedScript}&rdquo;
              </p>
            </div>
          </div>

          {/* Context */}
          {node.context && (
            <div className="mb-6">
              <div className="flex items-start gap-2 p-4 bg-[#502c85]/10 rounded-lg border border-[#502c85]/20">
                <Info className="h-5 w-5 text-[#502c85] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-[#502c85] mb-1">Context</h4>
                  <p className="text-sm text-[#502c85]">{node.context}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Points */}
          {node.keyPoints && node.keyPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#502c85]/80 uppercase tracking-wider mb-2">
                Key Points
              </h3>
              <ul className="space-y-1">
                {node.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle className="h-4 w-4 text-[#502c85] flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Listen For */}
          {node.listenFor && node.listenFor.length > 0 && (
            <div className="mb-6">
              <div className="flex items-start gap-2 p-4 bg-[#502c85]/10 rounded-lg border border-3 border-double border-[#502c85]/20">
                <Ear className="h-5 w-5 text-[#502c85] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-[#502c85] mb-2">Listen For</h4>
                  <ul className="space-y-1">
                    {node.listenFor.map((item, index) => (
                      <li key={index} className="text-sm text-[#502c85]">
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
            <div className="mb-6">
              <div className="flex items-start gap-2 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-900 mb-2">Avoid</h4>
                  <ul className="space-y-1">
                    {node.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-red-800">
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
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                Prospect Response:
              </h3>
              <div className="grid gap-3">
                {node.responses.map((response, index) => (
                  <button
                    key={index}
                    onClick={() => handleResponseClick(response.nextNode, response.label)}
                    className="group w-full text-left p-4 rounded-lg border-2 border-dashed border-[#502c85]/80 hover:border-solid hover:bg-[#502c85]/80 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[#502c85]/80 group-hover:text-white">
                          {response.label}
                        </p>
                        {response.note && (
                          <p className="text-sm text-[#502c85]/80 mt-1 group-hover:text-white">
                            {response.note}
                          </p>
                        )}
                      </div>
                      <span className="text-gray-400 group-hover:text-white text-xl">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End State */}
          {node.responses.length === 0 && (
            <div className="text-center py-6">
              <CheckCircle className="h-12 w-12 text-[#502c85] mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900">Call Complete</p>
              <p className="text-gray-500 mt-1">
                Don&apos;t forget to copy the summary and update your CRM!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
