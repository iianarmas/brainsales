"use client";

import { useCallStore } from "@/store/callStore";

export function NotesField() {
  const { notes, setNotes } = useCallStore();

  return (
    <textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      placeholder={`Type call notes here...`}
      className="w-full h-full min-h-[150px] p-4 bg-background border border-border rounded-lg resize-none focus:ring-1 focus:ring-primary/50 focus:border-primary outline-none text-sm text-foreground transition-all"
    />
  );
}
