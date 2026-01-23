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
import { SettingsPage } from "./SettingsPage";
import { useAdmin } from "@/hooks/useAdmin";
import { usePresence } from "@/hooks/usePresence";

export function CallScreen() {
  const { signOut, user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    showQuickReference,
    toggleQuickReference,
    reset,
    searchQuery,
    setSearchQuery,
    navigateTo,
    returnToFlow,
  } = useCallStore();

  // Track user presence
  usePresence();

  // Keyboard shortcuts
  useEffect(() => {
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

    // Discovery shortcuts mapping
    const discoveryShortcuts: Record<string, string> = {
      "a": "ehr_other",        // All other EHR (Cerner/Meditech/Other)
      "e": "ehr_epic",         // Epic
      "g": "epic_gallery_path", // Gallery
      "h": "onbase_path",       // OnBase
      "o": "other_dms_path",    // Other DMS
    };

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
      // Backspace to return to flow (only when not in input/textarea)
      if (
        e.key === "Backspace" &&
        !searchQuery &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        returnToFlow();
      }
      // Number keys 0-8 for quick objection access (only when not in input/search)
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
      // Letter keys for discovery shortcuts (only when not in input/search)
      if (
        !searchQuery &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        discoveryShortcuts[e.key.toLowerCase()] &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        navigateTo(discoveryShortcuts[e.key.toLowerCase()]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, showQuickReference, setSearchQuery, reset, toggleQuickReference, navigateTo, returnToFlow]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header id="main-header" className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-primary-light/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/images/icon_transparent_bg.png"
              alt="BrainSales"
              className="h-8 w-8"
            />
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-primary">BrainSales</h1>
              <span className="text-sm text-primary hidden sm:inline border-l border-primary pl-3">
                HIM Cold Call Flow
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Button */}
            <button
              onClick={() => setSearchQuery(" ")}
              className="flex items-center gap-2 px-3 py-2 border border-primary-light/30 text-sm text-primary hover:text-primary hover:bg-primary-light/10 active:bg-primary active:text-white rounded-lg transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline text-primary-light font-bold active:text-white focus:text-white">Search</span>
              <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-light/10 rounded">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>

            {/* Quick Reference Button */}
            <button
              onClick={toggleQuickReference}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                showQuickReference
                  ? "bg-primary text-white"
                  : "text-primary hover:text-primary hover:bg-primary-light/10"
              }`}
              title="Quick Reference (Ctrl+Q)"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline font-bold">Reference</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary hover:bg-primary-light/10 active:bg-primary active:text-white rounded-lg transition-colors"
              title="Reset Call (Ctrl+Shift+R)"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline font-bold">Reset</span>
            </button>

            {/* Admin Button */}
            {isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-primary text-primary hover:text-white hover:bg-primary rounded-lg transition-colors"
                title="Admin Dashboard"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline font-bold">Admin</span>
              </button>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-primary border border-primary hover:text-white hover:bg-primary rounded-lg transition-colors"
              title="Profile Settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline font-bold">Settings</span>
            </button>

            {/* User Info & Logout */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-primary">
              <div className="flex items-center gap-2">
                {profile?.profile_picture_url && (
                  <img
                    src={profile.profile_picture_url}
                    alt="Profile"
                    className="h-8 w-8 rounded-full object-cover border-2 border-primary-light/20"
                  />
                )}
                <span className="text-sm text-primary hidden md:inline font-medium">
                  {profile?.first_name && profile?.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile?.first_name || profile?.last_name || user?.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-grey hover:bg-primary-light/10 active:bg-primary active:text-white rounded-lg transition-colors"
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

      {/* Main Content - with padding to account for fixed header, TopicNav, and hotbar */}
      <div className="flex-1 flex overflow-hidden pt-[105px] pb-[120px]">
        {/* Left Panel - Resizable */}
        <ResizablePanel
          defaultWidth={350}
          minWidth={280}
          maxWidth={500}
          side="left"
          className="border-r border-primary-light/10 bg-white overflow-y-auto"
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
            className="border-l border-primary-light/10 bg-white overflow-y-auto"
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

      {/* Settings Modal */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
    </div>
  );
}
