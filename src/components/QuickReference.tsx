"use client";

import { useQuickReference } from "@/hooks/useQuickReference";
import { useProduct } from "@/context/ProductContext";
import { useCallStore } from "@/store/callStore";
import {
  X,
  CheckCircle,
  XCircle,
  Zap,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useState } from "react";

export function QuickReference() {
  const { toggleQuickReference } = useCallStore();
  const { currentProduct } = useProduct();
  const { data: quickReference, loading } = useQuickReference();
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col pt-2">
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
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#502c85]" />
          </div>
        )}

        {/* Differentiators */}
        {!loading && quickReference.differentiators.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#502c85]" />
              {currentProduct?.name || "Product"} Differentiators
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
        )}

        {/* Competitor Quick Reference */}
        {!loading && quickReference.competitors.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3">
              Competitor Intel
            </h3>
            <div className="space-y-2">
              {quickReference.competitors.map((competitor) => (
                <CompetitorCard
                  key={competitor.id}
                  competitor={competitor}
                  isExpanded={expandedCompetitor === competitor.id}
                  onToggle={() =>
                    setExpandedCompetitor(expandedCompetitor === competitor.id ? null : competitor.id)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Key Metrics */}
        {!loading && quickReference.metrics.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3">
              Key Metrics to Remember
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickReference.metrics.map((metric, index) => (
                <MetricCard key={index} value={metric.value} label={metric.label} />
              ))}
            </div>
          </section>
        )}

        {/* Quick Tips */}
        {!loading && quickReference.tips.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-[#502c85] uppercase tracking-wider mb-3">
              Quick Tips
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {quickReference.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-[#502c85]/80 font-bold">{index + 1}.</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
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
            <p className="text-gray-800">{competitor.advantage}</p>
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
