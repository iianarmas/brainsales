"use client";

import { useEffect, useState } from "react";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/context/AuthContext";
import { LeftPanel } from "./LeftPanel";
import { MainPanel } from "./MainPanel";
import { QuickReference } from "./QuickReference";
import { SearchModal } from "./SearchModal";
import { BookOpen, Search, RotateCcw, Library } from "lucide-react";
import { ObjectionHotbar } from "./ObjectionHotbar";
import { ResizablePanel } from "./ResizablePanel";
import { TopicNav } from "./TopicNav";
import { AdminDashboard } from "./AdminDashboard";
import { SettingsPage } from "./SettingsPage";
import { useAdmin } from "@/hooks/useAdmin";
import { usePresence } from "@/hooks/usePresence";
import { useCallFlow } from "@/hooks/useCallFlow";
import { KnowledgeBasePanel } from "./KnowledgeBase/KnowledgeBasePanel";
import { NotificationDropdown } from "./KnowledgeBase/NotificationDropdown";
import { ProfileDropdown } from "./ProfileDropdown";

export function CallScreen() {
  const { signOut, user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const [kbUpdateId, setKbUpdateId] = useState<string | undefined>();
  const [kbTab, setKbTab] = useState<'dexit' | 'team' | undefined>();
  const {
    showQuickReference,
    toggleQuickReference,
    reset,
    searchQuery,
    setSearchQuery,
    navigateTo,
    returnToFlow,
    setScripts,
  } = useCallStore();

  const {
    callFlow: dynamicCallFlow,
    loading: scriptsLoading,
  } = useCallFlow();

  // Sync dynamic scripts to store
  useEffect(() => {
    if (!scriptsLoading && dynamicCallFlow) {
      setScripts(dynamicCallFlow);
    }
  }, [dynamicCallFlow, scriptsLoading, setScripts]);

  // Track user presence
  usePresence();

  // Keyboard shortcuts
  useEffect(() => {
    // Quick objection shortcuts mapping
    const objectionShortcuts: Record<string, string> = {
      "0": "obj_whats_this_about",
      "1": "obj_not_interested",
      "2": "obj_timing",
      "3": "obj_happy_current",
      "4": "obj_send_info",
      "5": "obj_cost",
      "6": "obj_not_decision_maker",
      "7": "obj_contract",
      "8": "obj_implementing",
    };

    // Discovery shortcuts mapping
    const discoveryShortcuts: Record<string, string> = {
      "a": "disc_ehr_other",        // All other EHR (Cerner/Meditech/Other)
      "e": "disc_ehr_epic",         // Epic
      "g": "disc_gallery",          // Gallery
      "h": "disc_onbase",           // OnBase
      "o": "disc_other_dms",        // Other DMS
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
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${showQuickReference
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

            {/* Notification Bell */}
            <NotificationDropdown
              buttonClassName="relative p-2 text-primary hover:text-primary hover:bg-primary-light/10 transition-colors rounded-lg"
              onNotificationClick={(referenceId, referenceType) => {
                setKbUpdateId(referenceId);
                setKbTab(referenceType === 'team_update' ? 'team' : 'dexit');
                setShowKB(true);
              }}
            />

            {/* Knowledge Base Button */}
            <button
              onClick={() => setShowKB(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-primary text-primary hover:text-white hover:bg-primary rounded-lg transition-colors"
              title="Knowledge Base"
            >
              <Library className="h-4 w-4" />
              <span className="hidden sm:inline font-bold">Knowledge Base</span>
            </button>

            {/* Profile Dropdown */}
            <ProfileDropdown
              user={user}
              profile={profile}
              isAdmin={isAdmin}
              onOpenSettings={() => setShowSettings(true)}
              onOpenAdmin={() => setShowAdmin(true)}
              onLogout={signOut}
            />
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

      {/* Knowledge Base Panel */}
      <KnowledgeBasePanel
        open={showKB}
        onClose={() => {
          setShowKB(false);
          setKbUpdateId(undefined);
          setKbTab(undefined);
        }}
        initialUpdateId={kbUpdateId}
        initialTab={kbTab}
      />
    </div>
  );
}
