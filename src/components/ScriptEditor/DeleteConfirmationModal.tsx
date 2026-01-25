import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    nodeTitle: string;
    connectionCount: number;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export default function DeleteConfirmationModal({
    isOpen,
    nodeTitle,
    connectionCount,
    onClose,
    onConfirm,
    isDeleting,
}: DeleteConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-background border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <h3 className="font-semibold">Delete Node</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        disabled={isDeleting}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-foreground">
                        Are you sure you want to delete <span className="font-semibold">"{nodeTitle}"</span>?
                    </p>

                    {connectionCount > 0 && (
                        <div className="p-3 bg-destuctive/10 text-destructive text-sm rounded-md border border-destructive/20 bg-red-500/10 dark:bg-red-900/20">
                            <p className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Warning: This will break <strong>{connectionCount}</strong> connection{connectionCount !== 1 ? 's' : ''}.
                            </p>
                        </div>
                    )}

                    <p className="text-sm text-muted-foreground">
                        This action cannot be undone. All responses leading to and from this node will be removed.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-4 py-3 bg-muted/30 border-t border-border">
                    <button
                        onClick={onClose}
                        className="px-3 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors disabled:opacity-50"
                    >
                        {isDeleting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" />
                                Delete Node
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
