"use client";

import { CallNode } from "@/data/callFlow";
import { useCallStore } from "@/store/callStore";
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
    color: "green",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    label: "Opening",
  },
  discovery: {
    icon: Search,
    color: "blue",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    label: "Discovery",
  },
  pitch: {
    icon: Lightbulb,
    color: "purple",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
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
    color: "orange",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    label: "The Ask",
  },
  success: {
    icon: CheckCircle,
    color: "green",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    label: "Success",
  },
  end: {
    icon: XCircle,
    color: "gray",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
    label: "End Call",
  },
};

export function NodeDisplay({ node }: NodeDisplayProps) {
  const { navigateTo, addObjection } = useCallStore();
  const config = nodeTypeConfig[node.type];
  const Icon = config.icon;

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
            <h2 className="text-xl font-bold text-gray-900">{node.title}</h2>
          </div>
        </div>
      </div>

      {/* Script Section */}
      <div className={`bg-white ${config.borderColor} border border-t-0 rounded-b-xl`}>
        <div className="p-6">
          {/* Main Script */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Say This:
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-lg text-gray-900 whitespace-pre-line leading-relaxed font-bold italic">
                &ldquo;{node.script}&rdquo;
              </p>
            </div>
          </div>

          {/* Context */}
          {node.context && (
            <div className="mb-6">
              <div className="flex items-start gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Context</h4>
                  <p className="text-sm text-blue-800">{node.context}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Points */}
          {node.keyPoints && node.keyPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Key Points
              </h3>
              <ul className="space-y-1">
                {node.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Listen For */}
          {node.listenFor && node.listenFor.length > 0 && (
            <div className="mb-6">
              <div className="flex items-start gap-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <Ear className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-900 mb-2">Listen For</h4>
                  <ul className="space-y-1">
                    {node.listenFor.map((item, index) => (
                      <li key={index} className="text-sm text-amber-800">
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
              <div className="flex items-start gap-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-purple-900 mb-1">Competitor Intel</h4>
                  <p className="text-sm text-purple-800">{node.metadata.competitorInfo}</p>
                </div>
              </div>
            </div>
          )}

          {/* Response Buttons */}
          {node.responses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Prospect Response:
              </h3>
              <div className="grid gap-3">
                {node.responses.map((response, index) => (
                  <button
                    key={index}
                    onClick={() => handleResponseClick(response.nextNode, response.label)}
                    className="group w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-blue-900">
                          {response.label}
                        </p>
                        {response.note && (
                          <p className="text-sm text-gray-500 mt-1 group-hover:text-blue-700">
                            {response.note}
                          </p>
                        )}
                      </div>
                      <span className="text-gray-400 group-hover:text-blue-500 text-xl">
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
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
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
