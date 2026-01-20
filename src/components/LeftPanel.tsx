"use client";

import { useCallStore } from "@/store/callStore";
import { Breadcrumb } from "./Breadcrumb";
import { NotesField } from "./NotesField";
import { MetadataDisplay } from "./MetadataDisplay";
import { MeetingDetails } from "./MeetingDetails";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";

export function LeftPanel() {
  const { goBack, conversationPath, copySummary, outcome } = useCallStore();
  const [copied, setCopied] = useState(false);

  const handleCopySummary = async () => {
    await copySummary();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
              : "bg-gray-50 text-gray-400 cursor-not-allowed"
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Conversation Path
        </h3>
        <Breadcrumb />
      </div>

      {/* Metadata */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
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
      <div className="flex-1 min-h-[150px] mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Notes
        </h3>
        <NotesField />
      </div>

      {/* Copy Summary Button */}
      <button
        onClick={handleCopySummary}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
          copied
            ? "bg-green-500 text-white"
            : outcome === "meeting_set"
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {copied ? (
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
    </div>
  );
}
