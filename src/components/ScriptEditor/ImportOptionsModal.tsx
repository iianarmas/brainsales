
import React from "react";
import { AlertTriangle, Upload, FileJson } from "lucide-react";

interface ImportOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (strategy: "merge" | "overwrite") => void;
    fileName: string;
}

export default function ImportOptionsModal({
    isOpen,
    onClose,
    onImport,
    fileName,
}: ImportOptionsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-[480px] bg-card border border-border rounded-lg shadow-lg p-6 space-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold">Import Script</h2>
                        <p className="text-muted-foreground flex items-center justify-center gap-2">
                            <FileJson className="w-4 h-4" />
                            {fileName}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Merge Option */}
                    <button
                        onClick={() => onImport("merge")}
                        className="flex flex-col items-center p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors gap-3 text-center group"
                    >
                        <div className="font-semibold group-hover:text-primary transition-colors">Merge</div>
                        <p className="text-xs text-muted-foreground">
                            Adds new nodes and updates existing ones. Retains nodes that aren't in the file.
                        </p>
                    </button>

                    {/* Overwrite Option */}
                    <button
                        onClick={() => onImport("overwrite")}
                        className="flex flex-col items-center p-4 border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors gap-3 text-center group"
                    >
                        <div className="font-semibold text-destructive group-hover:text-destructive transition-colors">Overwrite</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="font-bold text-destructive block mb-1">⚠️ Destructive</span>
                            Deletes ALL existing nodes and replaces them with data from the file.
                        </p>
                    </button>
                </div>

                <div className="bg-muted/50 p-3 rounded text-xs text-muted-foreground flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p>
                        Please double check your file before importing. This action will modify your call flow database directly.
                    </p>
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
