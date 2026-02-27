"use client";

import { useCallStore } from "@/store/callStore";
import { Breadcrumb } from "./Breadcrumb";
import { NotesField } from "./NotesField";
import { MetadataDisplay } from "./MetadataDisplay";
import { MeetingDetails } from "./MeetingDetails";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { Logo } from "./Logo";
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
    <div className="h-full flex flex-col p-4 md:p-6 overflow-y-auto lg:overflow-hidden bg-sidebar-background text-foreground transition-colors">
      {/* Mobile-only Branding */}
      <div className="lg:hidden flex items-center gap-2 mb-6">
        <Logo className="h-6 w-6" />
        <span className="text-xl font-bold text-primary">BrainSales</span>
      </div>

      {/* Navigation Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all shadow-sm ${canGoBack
            ? "border-2 border-primary hover:bg-primary hover:text-primary-foreground text-primary"
            : "bg-muted text-muted-foreground/30 cursor-not-allowed border border-border"
            }`}
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="mb-4">
        <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 opacity-90">
          Conversation Path
        </h3>
        <Breadcrumb />
      </div>

      {/* Metadata */}
      <div className="mb-4">
        <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 opacity-90">
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
        <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 opacity-90">
          Notes
        </h3>
        <div className="flex-1 overflow-y-auto">
          <NotesField />
        </div>
      </div>

      {/* Copy Summary Button */}
      <button
        onClick={handleCopySummary}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${copiedSummary
          ? "bg-primary text-primary-foreground"
          : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
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
        className={`w-full flex items-center mt-2 justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all mb-2 shadow-sm ${copiedScripts
          ? "bg-primary text-primary-foreground"
          : "border-2 border-primary hover:bg-primary/5 text-primary"
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
