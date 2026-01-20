"use client";

import { useState } from "react";
import { useCallStore } from "@/store/callStore";
import { Copy, Check, Calendar, Link, FileText } from "lucide-react";

export function MeetingDetails() {
  const { metadata } = useCallStore();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const contactName = metadata.prospectName || "___";
  const companyName = metadata.organization || "___";

  const subject = `📅 Reserved for ${contactName}: 314e Dexit Discovery with ${companyName}`;

  const body = `Hi ${contactName}, thanks for your conversation and willingness to hear about our AI-powered intelligent Document Processing System called Dexit.

Join Zoom Meeting:
https://314e.zoom.us/j/6466391035

You can learn more about Dexit at: https://www.314e.com/dexit/
--
Chris Armas
Business Development Representative
314e Corporation
E: chris.armas@314ecorp.us
M: +1.608.597.4334
T: +1.510.371.6736`;

  const zoomLink = "https://314e.zoom.us/j/6466391035";

  const copyToClipboard = async (text: string, itemId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(itemId);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold text-green-900">Meeting Scheduled</h3>
      </div>

      {/* Subject Line */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-green-700 uppercase tracking-wider">
            Subject Line
          </label>
          <button
            onClick={() => copyToClipboard(subject, "subject")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              copiedItem === "subject"
                ? "bg-green-600 text-white"
                : "bg-white text-green-700 border border-green-300 hover:bg-green-100"
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
        <div className="bg-white rounded p-2 text-sm text-gray-800 border border-green-200">
          {subject}
        </div>
      </div>

      {/* Meeting Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-green-700 uppercase tracking-wider">
            Meeting Body
          </label>
          <button
            onClick={() => copyToClipboard(body, "body")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              copiedItem === "body"
                ? "bg-green-600 text-white"
                : "bg-white text-green-700 border border-green-300 hover:bg-green-100"
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
        <div className="bg-white rounded p-2 text-xs text-gray-700 border border-green-200 max-h-[120px] overflow-y-auto whitespace-pre-line">
          {body}
        </div>
      </div>

      {/* Zoom Link */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-green-700 uppercase tracking-wider">
            Zoom Link
          </label>
          <button
            onClick={() => copyToClipboard(zoomLink, "link")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              copiedItem === "link"
                ? "bg-green-600 text-white"
                : "bg-white text-green-700 border border-green-300 hover:bg-green-100"
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
        <div className="bg-white rounded p-2 text-sm text-blue-600 border border-green-200 font-mono">
          {zoomLink}
        </div>
      </div>
    </div>
  );
}
