"use client";

import { useCallStore } from "@/store/callStore";
import { Breadcrumb } from "./Breadcrumb";
import { NotesField } from "./NotesField";
import { MetadataDisplay } from "./MetadataDisplay";
import { MeetingDetails } from "./MeetingDetails";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";

export function LeftPanel() {
  const { goBack, conversationPath, copySummary, copyScripts, outcome } = useCallStore();
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedScripts, setCopiedScripts] = useState(false);

  const handleCopySummary = async () => {
    await copySummary();
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyScripts = async () => {
    await copyScripts();
    setCopiedScripts(true);
    setTimeout(() => setCopiedScripts(false), 2000);
  };

  const canGoBack = conversationPath.length > 1;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Navigation Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            canGoBack
              ? "border border-[#502c85]/50 hover:text-white hover:bg-[#502c85] text-[#502c85]"
              : "bg-gray-50 text-gray-400 cursor-not-allowed"
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-[#502c85] uppercase tracking-wider mb-2">
          Conversation Path
        </h3>
        <Breadcrumb />
      </div>

      {/* Metadata */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-[#502c85] uppercase tracking-wider mb-2">
          Call Context
        </h3>
        <MetadataDisplay />
      </div>

      {/* Meeting Details - show when meeting is set */}
      {outcome === "meeting_set" && (
        <div className="mb-4">
          <MeetingDetails />
        </div>
      )}

      {/* Notes */}
      <div className="flex-1 min-h-[150px] max-h-[300px] mb-4 overflow-hidden flex flex-col">
        <h3 className="text-xs font-semibold text-[#502c85] uppercase tracking-wider mb-2">
          Notes
        </h3>
        <div className="flex-1 overflow-y-auto">
          <NotesField />
        </div>
      </div>

      {/* Copy Summary Button */}
      <button
        onClick={handleCopySummary}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
          copiedSummary
            ? "bg-[#502c85] text-white"
            : outcome === "meeting_set"
            ? "bg-[#502c85] hover:bg-[#502c85]/90 text-white"
            : "bg-[#502c85] hover:bg-[#502c85]/90 text-white"
        }`}
      >
        {copiedSummary ? (
          <>
            <Check className="h-5 w-5" />
            Copied to Clipboard!
          </>
        ) : (
          <>
            <Copy className="h-5 w-5" />
            Copy Summary
          </>
        )}
      </button>

      {/* Copy Scripts Button */}
      <button
        onClick={handleCopyScripts}
        className={`w-full flex items-center mt-2 justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all mb-2 ${
          copiedScripts
            ? "bg-[#502c85] text-white"
            : "border border-[#502c85] hover:bg-[#502c85] hover:text-white text-[#502c85]"
        }`}
      >
        {copiedScripts ? (
          <>
            <Check className="h-5 w-5" />
            Scripts Copied!
          </>
        ) : (
          <>
            <Copy className="h-5 w-5" />
            Copy Scripts
          </>
        )}
      </button>
    </div>
  );
}
