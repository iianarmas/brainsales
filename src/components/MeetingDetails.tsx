"use client";

import { useState } from "react";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/context/ProductContext";
import { Copy, Check, Calendar, Link, FileText } from "lucide-react";
import { replaceScriptPlaceholders } from "@/utils/replaceScriptPlaceholders";
import { CallMetadata } from "@/store/callStore";

export function MeetingDetails() {
  const { metadata } = useCallStore();
  const { profile } = useAuth();
  const { currentProduct } = useProduct();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const contactName = metadata.prospectName || "___";
  const companyName = metadata.organization || "___";
  const productConfig = currentProduct?.configuration;

  // Get user profile data with fallbacks
  const fullName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : 'Your Name';
  const email = profile?.company_email || 'your.email@314ecorp.us';
  const phone = profile?.company_phone_number || '+1.XXX.XXX.XXXX';

  // Use product-level zoom link set by admin
  const zoomLink = productConfig?.zoomLink || "";

  // Default templates
  const defaultSubject = `📅 Reserved for ${contactName}: 314e Discovery with ${companyName}`;
  const defaultBody = `Hi ${contactName}, thanks for your conversation and willingness to learn more about our solution.

Join Zoom Meeting:
${zoomLink}

--
${fullName}
Business Development Representative
314e Corporation
E: ${email}
M: ${phone}`;

  // Use templates from product config if available, fall back to defaults
  const subjectTemplate = productConfig?.meetingSubject || defaultSubject;
  const bodyTemplate = productConfig?.meetingBody || defaultBody;

  // Replace placeholders
  const subject = replaceScriptPlaceholders(subjectTemplate, profile, metadata as unknown as CallMetadata);
  const body = replaceScriptPlaceholders(bodyTemplate, profile, metadata as unknown as CallMetadata);

  const copyToClipboard = async (text: string, itemId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(itemId);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Meeting Scheduled</h3>
      </div>

      {/* Subject Line */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Subject Line
          </label>
          <button
            onClick={() => copyToClipboard(subject, "subject")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all font-medium border shadow-sm ${copiedItem === "subject"
              ? "bg-primary border-primary text-white"
              : "bg-surface-elevated text-foreground border-border-subtle hover:bg-surface-active"
              }`}
          >
            {copiedItem === "subject" ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy Subject
              </>
            )}
          </button>
        </div>
        <div className="bg-input rounded-lg p-3 text-sm text-foreground border border-border-subtle shadow-inner">
          {subject}
        </div>
      </div>

      {/* Meeting Body */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Meeting Body
          </label>
          <button
            onClick={() => copyToClipboard(body, "body")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all font-medium border shadow-sm ${copiedItem === "body"
              ? "bg-primary border-primary text-white"
              : "bg-surface-elevated text-foreground border-border-subtle hover:bg-surface-active"
              }`}
          >
            {copiedItem === "body" ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                Copy Body
              </>
            )}
          </button>
        </div>
        <div className="bg-input rounded-lg p-3 text-xs text-muted-foreground border border-border-subtle shadow-inner max-h-[150px] overflow-y-auto whitespace-pre-line leading-relaxed">
          {body}
        </div>
      </div>

      {/* Zoom Link */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Zoom Link
          </label>
          <button
            onClick={() => copyToClipboard(zoomLink, "link")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all font-medium border shadow-sm ${copiedItem === "link"
              ? "bg-primary border-primary text-white"
              : "bg-surface-elevated text-foreground border-border-subtle hover:bg-surface-active"
              }`}
          >
            {copiedItem === "link" ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Link className="h-3 w-3" />
                Copy Link
              </>
            )}
          </button>
        </div>
        <div className="bg-input rounded-lg p-3 text-sm text-blue-400 border border-border-subtle shadow-inner overflow-x-auto font-mono scrollbar-hide">
          {zoomLink}
        </div>
      </div>
    </div>
  );
}
