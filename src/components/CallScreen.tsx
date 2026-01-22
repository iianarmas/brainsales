"use client";

import { useEffect, useState } from "react";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/context/AuthContext";
import { LeftPanel } from "./LeftPanel";
import { MainPanel } from "./MainPanel";
import { QuickReference } from "./QuickReference";
import { SearchModal } from "./SearchModal";
import { LogOut, BookOpen, Search, RotateCcw, Settings } from "lucide-react";
import { ObjectionHotbar } from "./ObjectionHotbar";
import { ResizablePanel } from "./ResizablePanel";
import { TopicNav } from "./TopicNav";
import { AdminDashboard } from "./AdminDashboard";
import { useAdmin } from "@/hooks/useAdmin";
import { usePresence } from "@/hooks/usePresence";

export function CallScreen() {
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdmin();
  const [showAdmin, setShowAdmin] = useState(false);
  const {
    showQuickReference,
    toggleQuickReference,
    reset,
    searchQuery,
    setSearchQuery,
    navigateTo,
  } = useCallStore();

  // Track user presence
  usePresence();

  // Quick objection shortcuts mapping
  const objectionShortcuts: Record<string, string> = {
    "0": "objection_whats_this_about",
    "1": "objection_not_interested",
    "2": "objection_timing",
    "3": "objection_happy_current",
    "4": "objection_send_info",
    "5": "objection_cost",
    "6": "objection_not_decision_maker",
    "7": "objection_contract",
    "8": "objection_implementing",
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchQuery(searchQuery ? "" : " ");
      }
      // Ctrl/Cmd + R for reset (prevent browser refresh)
      if ((e.ctrlKey || e.metaKey) && e.key === "r" && e.shiftKey) {
        e.preventDefault();
        reset();
      }
      // Ctrl/Cmd + Q for quick reference
      if ((e.ctrlKey || e.metaKey) && e.key === "q") {
        e.preventDefault();
        toggleQuickReference();
      }
      // Escape to close modals
      if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        if (showQuickReference) toggleQuickReference();
      }
      // Number keys 1-8 for quick objection access (only when not in input/search)
      if (
        !searchQuery &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        objectionShortcuts[e.key] &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        navigateTo(objectionShortcuts[e.key]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, showQuickReference, setSearchQuery, reset, toggleQuickReference, navigateTo]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">BrainSales</h1>
            <span className="text-sm text-gray-500 hidden sm:inline">
              HIM Cold Call Flow
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Button */}
            <button
              onClick={() => setSearchQuery(" ")}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 rounded">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>

            {/* Quick Reference Button */}
            <button
              onClick={toggleQuickReference}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                showQuickReference
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              title="Quick Reference (Ctrl+Q)"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Reference</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Reset Call (Ctrl+Shift+R)"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Admin Button */}
            {isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                title="Admin Dashboard"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            {/* User Info & Logout */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
              <span className="text-sm text-gray-500 hidden md:inline">
                {user?.email}
              </span>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Topic Navigation */}
      <TopicNav />

      {/* Main Content - with bottom padding to account for fixed hotbar */}
      <div className="flex-1 flex overflow-hidden pb-[120px]">
        {/* Left Panel - Resizable */}
        <ResizablePanel
          defaultWidth={350}
          minWidth={280}
          maxWidth={500}
          side="left"
          className="border-r border-gray-200 bg-white overflow-y-auto"
        >
          <LeftPanel />
        </ResizablePanel>

        {/* Main Panel - Flexible */}
        <div className="flex-1 overflow-y-auto">
          <MainPanel />
        </div>

        {/* Quick Reference Sidebar - Resizable */}
        {showQuickReference && (
          <ResizablePanel
            defaultWidth={350}
            minWidth={280}
            maxWidth={500}
            side="right"
            className="border-l border-gray-200 bg-white overflow-y-auto"
          >
            <QuickReference />
          </ResizablePanel>
        )}
      </div>

      {/* Objection Hotbar - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <ObjectionHotbar />
      </div>

      {/* Search Modal */}
      {searchQuery && <SearchModal />}

      {/* Admin Dashboard Modal */}
      {showAdmin && <AdminDashboard onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
