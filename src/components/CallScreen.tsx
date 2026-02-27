"use client";

import { useEffect, useRef, useState } from "react";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/context/AuthContext";
import { LeftPanel } from "./LeftPanel";
import { MainPanel } from "./MainPanel";
import { QuickReference } from "./QuickReference";
import { SearchDropdown } from "./SearchDropdown";
import { BookOpen, Search, RotateCcw, Library, Menu, X } from "lucide-react";
import { ObjectionHotbar } from "./ObjectionHotbar";
import { ResizablePanel } from "./ResizablePanel";
import { TopicNav } from "./TopicNav";
import { SettingsPage } from "./SettingsPage";
import { useAdmin } from "@/hooks/useAdmin";
import { usePresence } from "@/hooks/usePresence";
import { useCallFlow } from "@/hooks/useCallFlow";
import { useObjectionShortcuts } from "@/hooks/useObjectionShortcuts";
import { KnowledgeBasePanel } from "./KnowledgeBase/KnowledgeBasePanel";
import { NotificationDropdown } from "./KnowledgeBase/NotificationDropdown";
import { ProfileDropdown } from "./ProfileDropdown";
import { ProductSwitcher } from "./ProductSwitcher";
import { OnlineUsersHeader } from "./OnlineUsersHeader";
import { useProduct } from "@/context/ProductContext";
import LiveTranscript from "./LiveTranscript";
import { Logo } from "./Logo";
import { LoadingScreen } from "./LoadingScreen";
import { Tooltip } from "./Tooltip";

export function CallScreen() {
  const { signOut, user, profile, session } = useAuth();
  const { isAdmin } = useAdmin();
  const [showSettings, setShowSettings] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const [kbUpdateId, setKbUpdateId] = useState<string | undefined>();
  const [kbTab, setKbTab] = useState<'product' | 'team' | undefined>();
  const [showMobileLeftPanel, setShowMobileLeftPanel] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    showQuickReference,
    toggleQuickReference,
    reset,
    searchQuery,
    setSearchQuery,
    search,
    navigateTo,
    returnToFlow,
    setScripts,
    setProductId,
    isCompanionActive,
    scripts,
    _hasHydrated,
  } = useCallStore();

  // Use product context for product-specific data
  const { currentProduct } = useProduct();

  const {
    callFlow: dynamicCallFlow,
    loading: scriptsLoading,
  } = useCallFlow(currentProduct?.id, session?.access_token);

  // Get dynamic objection shortcuts from product config
  const { keyToNode: objectionShortcuts } = useObjectionShortcuts();

  // Sync dynamic scripts to store - optimized with ref to prevent flicker
  const lastSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scriptsLoading && dynamicCallFlow) {
      const flowStr = JSON.stringify(dynamicCallFlow);
      if (lastSyncRef.current !== flowStr) {
        setScripts(dynamicCallFlow);
        lastSyncRef.current = flowStr;
      }
    }
  }, [dynamicCallFlow, scriptsLoading, setScripts]);

  // Sync product ID to store for analytics
  useEffect(() => {
    setProductId(currentProduct?.id ?? null);
  }, [currentProduct?.id, setProductId]);

  // Track user presence
  usePresence();

  // Keyboard shortcuts
  useEffect(() => {
    // Discovery shortcuts mapping
    const discoveryShortcuts: Record<string, string> = {
      "a": "disc_ehr_other",        // All other EHR (Cerner/Meditech/Other)
      "e": "disc_ehr_epic",         // Epic
      "g": "disc_gallery",          // Gallery
      "h": "disc_onbase",           // OnBase
      "o": "disc_other_dms",        // Other DMS
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K for search - focus the inline search bar
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
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
        if (searchQuery) {
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
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
  }, [searchQuery, showQuickReference, setSearchQuery, reset, toggleQuickReference, navigateTo, returnToFlow, objectionShortcuts]);

  // Show loading screen ONLY if we are truly empty and haven't hydrated yet.
  // If we have cached data in the store, we should show it even if a fetch is in progress.
  const hasData = Object.keys(scripts).length > 0;

  // Only show the full screen loader if we truly have NO data yet (initial cold load).
  // If we have scripts in the store (from synchronous initialization), SHOW THEM immediately.
  if (!hasData && (!_hasHydrated || scriptsLoading)) {
    return <LoadingScreen fullScreen={true} message={!_hasHydrated ? "Initializing..." : "Loading call flow..."} />;
  }

  return (
    <div className="h-screen bg-primary/[0.02] flex flex-col overflow-hidden transition-colors">
      {/* Top Bar */}
      <header id="main-header" className="relative z-50 bg-header-background border-b border-header-border px-3 md:px-4 py-2 md:py-3 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile Left Panel Toggle */}
            <button
              onClick={() => setShowMobileLeftPanel(!showMobileLeftPanel)}
              className="lg:hidden flex items-center justify-center p-2 text-primary hover:bg-primary-light/10 rounded-lg transition-colors"
              title="Toggle Context Panel"
            >
              {showMobileLeftPanel ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Logo className="h-8 w-8 md:h-9 md:w-9" />
            <div className="flex items-center gap-2 md:gap-3">
              <h1 className="text-lg md:text-xl font-bold text-primary tracking-tight">BrainSales</h1>
              {currentProduct && (
                <span className="text-sm font-semibold text-primary hidden md:inline border-l-2 border-primary/30 pl-3">
                  Call Flow
                </span>
              )}
            </div>
            {/* Product Switcher - only shows if user has multiple products */}
            <ProductSwitcher variant="compact" className="ml-2 md:ml-4 hidden sm:block" />
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* Online Users */}
            <OnlineUsersHeader />

            {/* Inline Search Bar */}
            <div className="relative" data-search-input>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => search(e.target.value)}
                onFocus={() => { if (!searchQuery) setSearchQuery(" "); }}
                placeholder="Search..."
                className="w-28 md:w-48 lg:w-64 pl-8 pr-8 py-2 text-sm border-2 border-border/60 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background transition-all"
                title="Search (Ctrl+K)"
              />
              {searchQuery ? (
                <button
                  onClick={() => { setSearchQuery(""); searchInputRef.current?.blur(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-foreground/40 hover:text-foreground/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-primary bg-primary/10 rounded border border-primary/30">
                  <span>⌘</span>K
                </kbd>
              )}
              <SearchDropdown />
            </div>

            {/* Co-Pilot Button */}
            <Tooltip content="Toggle AI Co-Pilot" variant="invert">
              <button
                onClick={() => useCallStore.getState().toggleCompanion()}
                className={`flex items-center gap-2 px-2 md:px-3 py-2 text-sm rounded-lg transition-all border-2 font-bold ${isCompanionActive
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                  }`}
              >
                <div className={`w-2 h-2 rounded-full ${isCompanionActive ? 'bg-white animate-pulse' : 'bg-primary'}`} />
                <span className="hidden lg:inline">Co-Pilot</span>
              </button>
            </Tooltip>

            {/* Quick Reference Button */}
            <Tooltip content="Quick Reference (Ctrl+Q)" variant="invert">
              <button
                onClick={toggleQuickReference}
                className={`flex items-center gap-2 px-2 md:px-3 py-2 text-sm rounded-lg transition-all border-2 font-bold ${showQuickReference
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "text-primary border-transparent hover:border-primary/30 hover:bg-primary/10"
                  }`}
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden lg:inline">Reference</span>
              </button>
            </Tooltip>

            {/* Knowledge Base Button - hidden on small screens */}
            {/* Knowledge Base Button - hidden on small screens */}
            <Tooltip content="Knowledge Base" variant="invert">
              <button
                onClick={() => setShowKB(true)}
                className="hidden sm:flex items-center gap-2 px-2 md:px-3 py-2 text-sm border-2 border-primary text-primary hover:text-primary-foreground hover:bg-primary rounded-lg font-bold transition-all shadow-sm"
              >
                <Library className="h-4 w-4" />
                <span className="hidden lg:inline">Knowledge Base</span>
              </button>
            </Tooltip>

            {/* Reset Button */}
            <Tooltip content="Reset Call (Ctrl+Shift+R)" variant="invert">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-2 md:px-3 py-2 text-sm text-primary hover:bg-primary/10 active:bg-primary active:text-primary-foreground rounded-lg font-bold transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden lg:inline">Reset</span>
              </button>
            </Tooltip>

            {/* Notification Bell */}
            <NotificationDropdown
              buttonClassName="relative p-2 text-primary hover:text-primary hover:bg-primary-light/10 transition-colors rounded-lg"
              onNotificationClick={(referenceId, referenceType) => {
                setKbUpdateId(referenceId);
                setKbTab(referenceType === 'team_update' ? 'team' : 'product');
                setShowKB(true);
              }}
            />

            {/* Profile Dropdown */}
            <ProfileDropdown
              user={user}
              profile={profile}
              isAdmin={isAdmin}
              onOpenSettings={() => setShowSettings(true)}
              onLogout={signOut}
            />
          </div>
        </div>
      </header>

      {/* Topic Navigation */}
      <TopicNav />

      {/* Mobile Left Panel Overlay - outside flex layout */}
      {showMobileLeftPanel && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[60]"
          onClick={() => setShowMobileLeftPanel(false)}
        />
      )}

      {/* Mobile Left Panel Drawer - fixed, outside flex layout */}
      <div
        className={`
          lg:hidden fixed top-0 left-0 h-full w-[85vw] max-w-[350px] z-[70]
          bg-sidebar-background border-r border-sidebar-border shadow-xl transition-colors
          transform transition-transform duration-300 ease-in-out
          ${showMobileLeftPanel ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <LeftPanel />
      </div>

      {/* Mobile Quick Reference Drawer */}
      {showQuickReference && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[60]"
          onClick={toggleQuickReference}
        />
      )}
      <div
        className={`
          md:hidden fixed top-0 right-0 h-full w-[85vw] max-w-[350px] z-[70]
          bg-background border-l border-border shadow-xl transition-colors
          transform transition-transform duration-300 ease-in-out
          ${showQuickReference ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <QuickReference />
      </div>

      {/* Main Content - with padding to account for fixed header, TopicNav, and hotbar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Desktop only, resizable */}
        <div className="hidden lg:block">
          <ResizablePanel
            defaultWidth={350}
            minWidth={280}
            maxWidth={500}
            side="left"
            className="border-r border-sidebar-border bg-sidebar-background overflow-y-auto h-full transition-colors"
          >
            <LeftPanel />
          </ResizablePanel>
        </div>

        {/* Main Panel - Flexible, full width on mobile */}
        <div className="flex-1 overflow-y-auto">
          <MainPanel />
        </div>

        {/* Quick Reference Sidebar - Hidden on mobile, resizable on desktop */}
        {showQuickReference && (
          <ResizablePanel
            defaultWidth={350}
            minWidth={280}
            maxWidth={500}
            side="right"
            className="hidden md:block border-l border-border bg-background overflow-y-auto transition-colors"
          >
            <QuickReference />
          </ResizablePanel>
        )}

        {/* Live Transcript Sidebar - Visible when Companion is active */}
        {isCompanionActive && (
          <ResizablePanel
            defaultWidth={350}
            minWidth={280}
            maxWidth={600}
            side="right"
            className="hidden lg:block border-l border-border bg-background overflow-hidden h-full transition-colors"
          >
            <LiveTranscript />
          </ResizablePanel>
        )}
      </div>

      <ObjectionHotbar />

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
