import { GitBranch, List } from "lucide-react";
import type { EditorView } from "@/app/admin/scripts/page";

interface ViewToggleProps {
  view: EditorView;
  onViewChange: (view: EditorView) => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex bg-muted rounded-lg p-0.5 border border-border">
      <button
        onClick={() => onViewChange("visual")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === "visual"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
          }`}
      >
        <GitBranch className="w-4 h-4" />
        Visual Editor
      </button>
      <button
        onClick={() => onViewChange("tree")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === "tree"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
          }`}
      >
        <List className="w-4 h-4" />
        Tree View
      </button>
    </div>
  );
}
