import React, { useState, useEffect } from "react";
import { X, Clock, RotateCcw, Plus, Loader2, Calendar } from "lucide-react";
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
}

export default function VersionHistoryModal({
    isOpen,
    onClose,
}: VersionHistoryModalProps) {
    const { session } = useAuth();
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [newLabel, setNewLabel] = useState("");

    // Fetch versions
    useEffect(() => {
        if (isOpen && session?.access_token) {
            fetchVersions();
        }
    }, [isOpen, session]);

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/scripts/versions", {
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                },
            });
            if (!response.ok) throw new Error("Failed to fetch versions");
            const data = await response.json();
            setVersions(data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLabel.trim()) return;

        try {
            setCreating(true);
            const response = await fetch("/api/admin/scripts/versions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ label: newLabel }),
            });

            if (!response.ok) throw new Error("Failed to create version");

            const newVersion = await response.json();
            setVersions((prev) => [newVersion, ...prev]);
            setNewLabel("");
            toast.success("Snapshot created!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to create snapshot");
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

            if (!response.ok) throw new Error("Failed to restore version");

            toast.success("Version restored successfully!");
            window.location.reload(); // Reload to fetch fresh data
        } catch (err) {
            console.error(err);
            toast.error("Failed to restore version");
        } finally {
            setRestoring(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background w-full max-w-md rounded-lg shadow-xl border border-border flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Flow Snapshots
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Create Input */}
                <div className="p-4 border-b border-border bg-muted/20">
                    <form onSubmit={handleCreateVersion} className="flex gap-2">
                        <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="Name this version (e.g. 'Before big refactor')"
                            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                            type="submit"
                            disabled={creating || !newLabel.trim()}
                            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 text-sm font-medium flex items-center gap-2"
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
                                className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg group hover:bg-muted/50 transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-sm">{version.label}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(version.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRestore(version)}
                                    disabled={restoring === version.id}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-background border border-border rounded text-xs font-medium hover:bg-accent flex items-center gap-1.5"
                                >
                                    {restoring === version.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <RotateCcw className="h-3 w-3" />
                                    )}
                                    Restore
                                </button>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}
