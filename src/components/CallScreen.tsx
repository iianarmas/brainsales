"use client";

import { useEffect, useState } from "react";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/context/AuthContext";
import { LeftPanel } from "./LeftPanel";
import { MainPanel } from "./MainPanel";
import { QuickReference } from "./QuickReference";
import { SearchModal } from "./SearchModal";
import { BookOpen, Search, RotateCcw, Library, Menu, X } from "lucide-react";
import { ObjectionHotbar } from "./ObjectionHotbar";
import { ResizablePanel } from "./ResizablePanel";
import { TopicNav } from "./TopicNav";
import { AdminDashboard } from "./AdminDashboard";
import { SettingsPage } from "./SettingsPage";
import { useAdmin } from "@/hooks/useAdmin";
import { usePresence } from "@/hooks/usePresence";
import { useCallFlow } from "@/hooks/useCallFlow";
import { useObjectionShortcuts } from "@/hooks/useObjectionShortcuts";
import { KnowledgeBasePanel } from "./KnowledgeBase/KnowledgeBasePanel";
import { NotificationDropdown } from "./KnowledgeBase/NotificationDropdown";
import { ProfileDropdown } from "./ProfileDropdown";
import { ProductSwitcher } from "./ProductSwitcher";
import { useProduct } from "@/context/ProductContext";

export function CallScreen() {
  const { signOut, user, profile, session } = useAuth();
  const { isAdmin } = useAdmin();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const [kbUpdateId, setKbUpdateId] = useState<string | undefined>();
  const [kbTab, setKbTab] = useState<'product' | 'team' | undefined>();
  const [showMobileLeftPanel, setShowMobileLeftPanel] = useState(false);
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

  // Use product context for product-specific data
  const { currentProduct } = useProduct();

  const {
    callFlow: dynamicCallFlow,
    loading: scriptsLoading,
  } = useCallFlow(currentProduct?.id, session?.access_token);

  // Get dynamic objection shortcuts from product config
  const { keyToNode: objectionShortcuts } = useObjectionShortcuts();

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
  }, [searchQuery, showQuickReference, setSearchQuery, reset, toggleQuickReference, navigateTo, returnToFlow, objectionShortcuts]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header id="main-header" className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-primary-light/10 px-3 md:px-4 py-2 md:py-3">
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

            <img
              src="/assets/images/icon_transparent_bg.png"
              alt="BrainSales"
              className="h-7 w-7 md:h-8 md:w-8"
            />
            <div className="flex items-center gap-2 md:gap-3">
              <h1 className="text-lg md:text-xl font-bold text-primary">BrainSales</h1>
              {currentProduct && (
                <span className="text-sm text-primary hidden md:inline border-l border-primary pl-3">
                  Call Flow
                </span>
              )}
            </div>
            {/* Product Switcher - only shows if user has multiple products */}
            <ProductSwitcher variant="compact" className="ml-2 md:ml-4 hidden sm:block" />
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* Search Button */}
            <button
              onClick={() => setSearchQuery(" ")}
              className="flex items-center gap-2 px-2 md:px-3 py-2 border border-primary-light/30 text-sm text-primary hover:text-primary hover:bg-primary-light/10 active:bg-primary active:text-white rounded-lg transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden md:inline text-primary-light font-bold active:text-white focus:text-white">Search</span>
              <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-light/10 rounded">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>

            {/* Quick Reference Button - hidden on mobile */}
            <button
              onClick={toggleQuickReference}
              className={`hidden md:flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${showQuickReference
                ? "bg-primary text-white"
                : "text-primary hover:text-primary hover:bg-primary-light/10"
                }`}
              title="Quick Reference (Ctrl+Q)"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden lg:inline font-bold">Reference</span>
            </button>

            {/* Knowledge Base Button - hidden on small screens */}
            <button
              onClick={() => setShowKB(true)}
              className="hidden sm:flex items-center gap-2 px-2 md:px-3 py-2 text-sm border border-primary text-primary hover:text-white hover:bg-primary rounded-lg transition-colors"
              title="Knowledge Base"
            >
              <Library className="h-4 w-4" />
              <span className="hidden lg:inline font-bold">Knowledge Base</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={reset}
              className="flex items-center gap-2 px-2 md:px-3 py-2 text-sm text-primary hover:text-primary hover:bg-primary-light/10 active:bg-primary active:text-white rounded-lg transition-colors"
              title="Reset Call (Ctrl+Shift+R)"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden lg:inline font-bold">Reset</span>
            </button>

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
              onOpenAdmin={() => setShowAdmin(true)}
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
          bg-white border-r border-primary-light/10 shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${showMobileLeftPanel ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full pt-[105px] pb-[100px] overflow-y-auto">
          <LeftPanel />
        </div>
      </div>

      {/* Main Content - with padding to account for fixed header, TopicNav, and hotbar */}
      <div className="flex-1 flex overflow-hidden pt-[105px] pb-[100px] md:pb-[120px]">
        {/* Left Panel - Desktop only, resizable */}
        <div className="hidden lg:block">
          <ResizablePanel
            defaultWidth={350}
            minWidth={280}
            maxWidth={500}
            side="left"
            className="border-r border-primary-light/10 bg-white overflow-y-auto h-full"
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
            className="hidden md:block border-l border-primary-light/10 bg-white overflow-y-auto"
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
