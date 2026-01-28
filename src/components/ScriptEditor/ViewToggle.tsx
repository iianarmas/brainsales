import { GitBranch, List } from "lucide-react";
import type { EditorView } from "@/app/admin/scripts/page";

interface ViewToggleProps {
  view: EditorView;
  onViewChange: (view: EditorView) => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => onViewChange("visual")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          view === "visual"
            ? "bg-white text-primary shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <GitBranch className="w-4 h-4" />
        Visual Editor
      </button>
      <button
        onClick={() => onViewChange("tree")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          view === "tree"
            ? "bg-white text-primary shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <List className="w-4 h-4" />
        Tree View
      </button>
    </div>
  );
}
