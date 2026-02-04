"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useProduct } from "@/context/ProductContext";
import ScriptEditor from "@/components/ScriptEditor/ScriptEditor";
import TreeEditor from "@/components/ScriptEditor/TreeEditor/TreeEditor";
import { LoadingScreen } from "@/components/LoadingScreen";
import { AlertCircle } from "lucide-react";

export type EditorView = "visual" | "tree";

export default function ReadOnlyScriptEditorPage() {
    const { user, loading: authLoading } = useAuth();
    const { isAdmin, loading: adminLoading } = useAdmin();
    const { currentProduct, loading: productLoading } = useProduct();
    const [view, setView] = useState<EditorView>("visual");

    const handleClose = () => {
        window.close();
    };

    if (authLoading || adminLoading || productLoading) {
        return <LoadingScreen message="Loading script editor..." />;
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-8">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                    <h1 className="text-xl font-bold text-gray-900">Not Logged In</h1>
                    <p className="text-gray-600">Please log in to view the Script Editor.</p>
                    <a
                        href="/"
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                    >
                        Go to Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            <div className="flex-1 overflow-hidden relative">
                <div className={`h-full ${view === "visual" ? "" : "hidden"}`}>
                    <ScriptEditor
                        onClose={handleClose}
                        view={view}
                        onViewChange={setView}
                        productId={currentProduct?.id}
                        isAdmin={isAdmin}
                    />
                </div>
                <div className={`h-full ${view === "tree" ? "" : "hidden"}`}>
                    <TreeEditor
                        view={view}
                        onViewChange={setView}
                        productId={currentProduct?.id}
                        isReadOnly={!isAdmin}
                        isAdmin={isAdmin}
                    />
                </div>
            </div>
        </div>
    );
}
