"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import ScriptEditor from "@/components/ScriptEditor/ScriptEditor";
import TreeEditor from "@/components/ScriptEditor/TreeEditor/TreeEditor";
import { LoadingScreen } from "@/components/LoadingScreen";
import { AlertCircle } from "lucide-react";

export type EditorView = "visual" | "tree";

export default function ScriptEditorPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [view, setView] = useState<EditorView>("visual");

  // Close handler - just close the tab
  const handleClose = () => {
    window.close();
  };

  // Still loading auth or admin status
  if (authLoading || adminLoading) {
    return <LoadingScreen message="Verifying permissions..." />;
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h1 className="text-xl font-bold text-gray-900">Not Logged In</h1>
          <p className="text-gray-600">Please log in to access the Script Editor.</p>
          <a
            href="/"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <AlertCircle className="h-12 w-12 text-orange-500" />
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600">You need admin permissions to access the Script Editor.</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // User is admin - show editor with view toggle
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden relative">
        <div className={`h-full ${view === "visual" ? "" : "hidden"}`}>
          <ScriptEditor onClose={handleClose} view={view} onViewChange={setView} />
        </div>
        <div className={`h-full ${view === "tree" ? "" : "hidden"}`}>
          <TreeEditor view={view} onViewChange={setView} />
        </div>
      </div>
    </div>
  );
}
