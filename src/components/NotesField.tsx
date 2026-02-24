"use client";

import { useCallStore } from "@/store/callStore";

export function NotesField() {
  const { notes, setNotes } = useCallStore();

  return (
    <textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      placeholder={`Type call notes here...`}
      className="w-full h-full min-h-[150px] p-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
    />
  );
}
