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
}: EditorToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg">
      <div className="flex items-center gap-1 p-1">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-border mr-2" />

        {/* History */}
        <button
          onClick={onHistory}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
          title="Version History"
        >
          <Clock className="h-4 w-4" />
          <span className="text-sm hidden xl:inline">History</span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Save */}
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors disabled:opacity-50"
          title="Save changes"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="text-sm">Save</span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
          title="Export to callFlow.ts"
        >
          <Download className="h-4 w-4" />
          <span className="text-sm">Export</span>
        </button>

        {/* Import */}
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
          title="Import from file"
        >
          <Upload className="h-4 w-4" />
          <span className="text-sm">Import</span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Auto-layout */}
        <button
          onClick={onAutoLayout}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
          title="Auto-layout nodes"
        >
          <Layout className="h-4 w-4" />
          <span className="text-sm">Auto-layout</span>
        </button>

        {/* Validate */}
        <button
          onClick={onValidate}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
          title="Validate flow"
        >
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Validate</span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Heatmap Toggle */}
        <button
          onClick={onToggleHeatmap}
          className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${showHeatmap ? "bg-orange-500/10 text-orange-500" : "hover:bg-muted"
            }`}
          title="Toggle Analytics Heatmap"
        >
          <Flame className={`h-4 w-4 ${showHeatmap ? "fill-orange-500" : ""}`} />
          <span className="text-sm">Heatmap</span>
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search nodes..."
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8 pr-3 py-2 w-48 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>
    </div>
  );
}
