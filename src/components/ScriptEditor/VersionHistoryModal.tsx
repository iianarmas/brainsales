import React, { useState, useEffect } from "react";
import { X, Clock, RotateCcw, Plus, Loader2, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface Version {
    id: string;
    created_at: string;
    label: string;
    created_by: string;
}

interface VersionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    productId?: string | null;
}

export default function VersionHistoryModal({
    isOpen,
    onClose,
    productId,
}: VersionHistoryModalProps) {
    const { session } = useAuth();
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [newLabel, setNewLabel] = useState("");

    // Fetch versions
    useEffect(() => {
        if (isOpen && session?.access_token) {
            fetchVersions();
        }
    }, [isOpen, session]);

    const fetchVersions = async () => {
        if (!productId && session?.access_token) {
            console.error("No product ID provided to VersionHistoryModal");
            toast.error("Product selection required for history");
            return;
        }

        try {
            setLoading(true);
            const headers: Record<string, string> = {
                Authorization: `Bearer ${session?.access_token}`,
            };
            if (productId) headers["X-Product-Id"] = productId;

            const response = await fetch("/api/admin/scripts/versions", {
                headers,
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch versions");
            }
            const data = await response.json();
            setVersions(data);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLabel.trim()) return;

        try {
            setCreating(true);
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
            };
            if (productId) headers["X-Product-Id"] = productId;

            const response = await fetch("/api/admin/scripts/versions", {
                method: "POST",
                headers,
                body: JSON.stringify({ label: newLabel }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create version");
            }

            const newVersion = await response.json();
            setVersions((prev) => [newVersion, ...prev]);
            setNewLabel("");
            toast.success("Snapshot created!");
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to create snapshot");
        } finally {
            setCreating(false);
        }
    };

    const handleRestore = async (version: Version) => {
        if (!confirm(`Are you sure you want to restore "${version.label}"? All current unsaved changes will be lost.`)) {
            return;
        }

        try {
            setRestoring(version.id);
            const response = await fetch(`/api/admin/scripts/versions/${version.id}/restore`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to restore version");
            }

            toast.success("Version restored successfully!");
            window.location.reload(); // Reload to fetch fresh data
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to restore version");
        } finally {
            setRestoring(null);
        }
    };

    const handleDelete = async (version: Version) => {
        if (!confirm(`Are you sure you want to delete "${version.label}"? This cannot be undone.`)) {
            return;
        }

        try {
            setDeleting(version.id);
            const response = await fetch(`/api/admin/scripts/versions/${version.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete version");
            }

            setVersions((prev) => prev.filter((v) => v.id !== version.id));
            toast.success("Snapshot deleted!");
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to delete snapshot");
        } finally {
            setDeleting(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background w-full max-w-md rounded-lg shadow-xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3">
                    <h3 className="font-semibold flex items-center gap-2 text-primary">
                        <Clock className="h-4 w-4" />
                        Flow Snapshots
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Create Input */}
                <div className="p-4 border-b border-primary-light/20 bg-muted/20">
                    <form onSubmit={handleCreateVersion} className="flex gap-2">
                        <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="Name this version (e.g. 'Before big refactor')"
                            className="flex-1 px-3 py-2 text-sm bg-background border border-primary-light/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                            type="submit"
                            disabled={creating || !newLabel.trim()}
                            className="px-3 py-2 bg-primary text-white rounded-lg disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Save
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : versions.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">
                            No versions saved yet.
                        </p>
                    ) : (
                        versions.map((version) => (
                            <div
                                key={version.id}
                                className="flex items-center justify-between p-3 bg-muted/30 border border-primary-light/50 rounded-lg group hover:bg-muted/50 transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-sm">{version.label}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(version.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleRestore(version)}
                                        disabled={restoring === version.id || deleting === version.id}
                                        className="px-3 py-1.5 bg-primary-light text-white rounded text-xs font-medium hover:bg-accent flex items-center gap-1.5"
                                    >
                                        {restoring === version.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <RotateCcw className="h-3 w-3" />
                                        )}
                                        Restore
                                    </button>
                                    <button
                                        onClick={() => handleDelete(version)}
                                        disabled={deleting === version.id || restoring === version.id}
                                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-red-600 hover:text-white rounded transition-colors"
                                        title="Delete snapshot"
                                    >
                                        {deleting === version.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}
