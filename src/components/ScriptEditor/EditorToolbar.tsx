"use client";

import React from "react";
import {
  Save,
  Download,
  Upload,
  Layout,
  Search,
  CheckCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Clock,
  RotateCcw,
  RotateCw,
  Flame,
  Sparkles,
} from "lucide-react";


interface EditorToolbarProps {
  onSave: () => void;
  saving: boolean;
  onAutoLayout: () => void;
  onValidate: () => void;
  onExport: () => void;
  onImport: () => void;
  onSearch: (term: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onHistory: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  isReadOnly?: boolean;
  isAdmin?: boolean;
  onAIGenerate?: () => void;
}

export default function EditorToolbar({
  onSave,
  saving,
  onAutoLayout,
  onValidate,
  onExport,
  onImport,
  onSearch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onHistory,
  showHeatmap,
  onToggleHeatmap,
  isReadOnly = false,
  isAdmin = false,
  onAIGenerate,
}: EditorToolbarProps) {
  return (
    <div className="absolute top-4 left-8 bg-background/95 backdrop-blur border border-primary-light/50 rounded-lg shadow-lg">
      <div className="flex items-center gap-1 p-1">
        {/* Undo/Redo */}
        {!isReadOnly && (
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-2 rounded transition-colors cursor-pointer hover:bg-primary-light/10 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="h-4 w-4 text-primary" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-2 rounded transition-colors cursor-pointer hover:bg-primary-light/10 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="h-4 w-4 text-primary" />
            </button>
          </div>
        )}

        {!isReadOnly && <div className="w-px h-6 bg-border mr-2" />}

        {/* History */}
        <button
          onClick={onHistory}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors"
          title="Version History"
        >
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm hidden xl:inline text-primary">History</span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Save */}
        {!isReadOnly && (
          <>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center text-primary gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors disabled:opacity-50"
              title="Save changes"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="text-sm text-primary">Save</span>
            </button>

            <div className="w-px h-6 bg-border" />
          </>
        )}

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors"
          title="Export to callFlow.ts"
        >
          <Download className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary">Export</span>
        </button>

        {/* Import */}
        {!isReadOnly && (
          <button
            onClick={onImport}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors"
            title="Import from file"
          >
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">Import</span>
          </button>
        )}

        <div className="w-px h-6 bg-border" />

        {/* Auto-layout */}
        {!isReadOnly && (
          <button
            onClick={onAutoLayout}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors"
            title="Auto-layout nodes"
          >
            <Layout className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">Auto-layout</span>
          </button>
        )}

        {/* Validate */}
        <button
          onClick={onValidate}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors"
          title="Validate flow"
        >
          <CheckCircle className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary">Validate</span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Heatmap Toggle */}
        <button
          onClick={onToggleHeatmap}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors ${showHeatmap ? "bg-primary/20 text-primary" : "hover:bg-muted"
            }`}
          title="Toggle Analytics Heatmap"
        >
          <Flame className={`h-4 w-4 text-primary ${showHeatmap ? "fill-primary" : ""}`} />
          <span className="text-sm text-primary">Heatmap</span>
        </button>

        {/* AI Generate */}
        {!isReadOnly && isAdmin && onAIGenerate && (
          <>
            <div className="w-px h-6 bg-border" />
            <button
              onClick={onAIGenerate}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-light/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Generate script with AI"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary">Generate with AI</span>
            </button>
          </>
        )}

        <div className="w-px h-6 bg-primary/20" />

        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-4 w-4 text-primary" />
          <input
            type="text"
            placeholder="Search nodes..."
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8 pr-3 py-2 w-48 bg-transparent text-sm focus:outline-none placeholder:text-primary/40"
          />
        </div>
      </div>
    </div>
  );
}
