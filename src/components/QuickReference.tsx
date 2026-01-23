"use client";

import { quickReference } from "@/data/callFlow";
import { useCallStore } from "@/store/callStore";
import {
  X,
  CheckCircle,
  XCircle,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export function QuickReference() {
  const { toggleQuickReference } = useCallStore();
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="font-bold text-[#502c85]">Quick Reference</h2>
        <button
          onClick={toggleQuickReference}
          className="p-1 hover:bg-[#502c85]/10 rounded transition-colors"
        >
          <X className="h-5 w-5 text-[#502c85]/70" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Dexit Differentiators */}
        <section>
          <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#502c85]" />
            Dexit Differentiators
          </h3>
          <ul className="space-y-2">
            {quickReference.differentiators.map((diff, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <CheckCircle className="h-4 w-4 text-[#502c85] flex-shrink-0 mt-0.5" />
                <span>{diff}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Competitor Quick Reference */}
        <section>
          <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3">
            Competitor Intel
          </h3>
          <div className="space-y-2">
            {Object.entries(quickReference.competitors).map(([key, competitor]) => (
              <CompetitorCard
                key={key}
                competitor={competitor}
                isExpanded={expandedCompetitor === key}
                onToggle={() =>
                  setExpandedCompetitor(expandedCompetitor === key ? null : key)
                }
              />
            ))}
          </div>
        </section>

        {/* Key Metrics */}
        <section>
          <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3">
            Key Metrics to Remember
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard value="70-80%" label="Time Savings" />
            <MetricCard value="95%+" label="Accuracy Rate" />
            <MetricCard value="10-20%" label="Human Review" />
            <MetricCard value="20+" label="Years Experience" />
          </div>
        </section>

        {/* Quick Tips */}
        <section>
          <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3">
            Quick Tips
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-[#502c85]/80 font-bold">1.</span>
              <span>Listen more than you talk - let them reveal pain</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#502c85]/80 font-bold">2.</span>
              <span>Don&apos;t attack competitors - complement existing systems</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#502c85]/80 font-bold">3.</span>
              <span>Focus on time savings, not features</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#502c85]/80 font-bold">4.</span>
              <span>20-minute demo is the goal - specific, not vague</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#502c85]/80 font-bold">5.</span>
              <span>Subscription pricing = lower barrier than capital expense</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

interface CompetitorCardProps {
  competitor: {
    name: string;
    strengths: string[];
    limitations: string[];
    advantage: string;
  };
  isExpanded: boolean;
  onToggle: () => void;
}

function CompetitorCard({ competitor, isExpanded, onToggle }: CompetitorCardProps) {
  return (
    <div className="border border-[#502c85]/20 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-[#502c85]/10 hover:bg-[#502c85]/20 transition-colors text-left"
      >
        <span className="font-medium text-gray-900">{competitor.name}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-[#502c85]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#502c85]" />
        )}
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3 text-sm">
          {/* Strengths */}
          <div>
            <p className="text-xs font-semibold text-[#502c85]/80 uppercase mb-1">
              Their Strengths
            </p>
            <ul className="space-y-1">
              {competitor.strengths.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="h-3 w-3 text-[#502c85]" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Limitations */}
          <div>
            <p className="text-xs font-semibold text-[#502c85]/80 uppercase mb-1">
              Their Limitations
            </p>
            <ul className="space-y-1">
              {competitor.limitations.map((l, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600">
                  <XCircle className="h-3 w-3 text-black/60" />
                  {l}
                </li>
              ))}
            </ul>
          </div>

          {/* Our Advantage */}
          <div className="bg-[#502c85]/10 p-2 rounded border border-[#502c85]/20">
            <p className="text-xs font-semibold text-[#502c85] uppercase mb-1">
              Our Advantage
            </p>
            <p className="text-blue-900">{competitor.advantage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#502c85] rounded-lg p-3 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-white">{label}</p>
    </div>
  );
}
