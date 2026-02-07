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
    <div className="bg-primary-light/10 rounded-lg p-4 border border-primary-light/20 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-primary">Meeting Scheduled</h3>
      </div>

      {/* Subject Line */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-primary uppercase tracking-wider">
            Subject Line
          </label>
          <button
            onClick={() => copyToClipboard(subject, "subject")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${copiedItem === "subject"
              ? "bg-primary text-white"
              : "bg-white text-primary border border-primary-light/20 hover:bg-primary-light hover:text-white"
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
        <div className="bg-white rounded p-2 text-sm text-gray-800 border border-primary-light/20">
          {subject}
        </div>
      </div>

      {/* Meeting Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-primary uppercase tracking-wider">
            Meeting Body
          </label>
          <button
            onClick={() => copyToClipboard(body, "body")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${copiedItem === "body"
              ? "bg-primary text-white"
              : "bg-white text-primary border border-primary-light/20 hover:bg-primary-light hover:text-white"
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
        <div className="bg-white rounded p-2 text-xs text-gray-700 border border-primary-light/20 max-h-[120px] overflow-y-auto whitespace-pre-line">
          {body}
        </div>
      </div>

      {/* Zoom Link */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-primary uppercase tracking-wider">
            Zoom Link
          </label>
          <button
            onClick={() => copyToClipboard(zoomLink, "link")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${copiedItem === "link"
              ? "bg-primary text-white"
              : "bg-white text-primary border border-primary-light/20 hover:bg-primary-light hover:text-white"
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
        <div className="bg-white rounded p-2 text-sm text-blue-600 border border-primary-light/20 overflow-y-auto font-mono">
          {zoomLink}
        </div>
      </div>
    </div>
  );
}
