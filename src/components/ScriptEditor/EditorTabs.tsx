import { Shield, Box, Library } from "lucide-react";

export type EditorTab = "official" | "sandbox" | "community";

interface EditorTabsProps {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  isAdmin: boolean;
}

const tabs: { id: EditorTab; label: string; icon: typeof Shield }[] = [
  { id: "official", label: "Official Flow", icon: Shield },
  { id: "sandbox", label: "My Sandbox", icon: Box },
  { id: "community", label: "Community Library", icon: Library },
];

export default function EditorTabs({ activeTab, onTabChange, isAdmin }: EditorTabsProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === id
              ? "bg-white text-primary shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
