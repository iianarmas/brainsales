"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { Loader2, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

interface InviteMeta {
    organizationName: string;
    organizationSlug: string;
    email: string | null;
    role: string;
    expiresAt: string;
}

export default function JoinPage() {
    const { token } = useParams<{ token: string }>();
    const { user, session } = useAuth();
    const router = useRouter();

    const [meta, setMeta] = useState<InviteMeta | null>(null);
    const [metaLoading, setMetaLoading] = useState(true);
    const [metaError, setMetaError] = useState<string | null>(null);

    const [accepting, setAccepting] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [acceptError, setAcceptError] = useState<string | null>(null);

    // Load invite metadata (public — no auth needed)
    useEffect(() => {
        if (!token) return;

        const fetchMeta = async () => {
            try {
                const res = await fetch(`/api/invite/${token}`);
                const data = await res.json();
                if (!res.ok) {
                    setMetaError(data.error ?? "This invite link is invalid or has expired.");
                    return;
                }
                setMeta(data);
            } catch {
                setMetaError("Failed to load invite details. Please check your connection.");
            } finally {
                setMetaLoading(false);
            }
        };

        fetchMeta();
    }, [token]);

    // Once user is signed in, auto-accept the invite
    useEffect(() => {
        if (!user || !session?.access_token || !meta || accepted || accepting) return;

        const accept = async () => {
            setAccepting(true);
            setAcceptError(null);

            try {
                const res = await fetch("/api/invite/accept", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (!res.ok) {
                    setAcceptError(data.error ?? "Failed to join workspace. Please try again.");
                    setAccepting(false);
                    return;
                }

                setAccepted(true);
                // Redirect to home after a brief moment
                setTimeout(() => router.push("/"), 2000);
            } catch {
                setAcceptError("Network error. Please try again.");
                setAccepting(false);
            }
        };

        accept();
    }, [user, session, meta, token, accepted, accepting, router]);

    const handleSignIn = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: typeof window !== "undefined" ? window.location.href : undefined,
            },
        });
    };

    // ── Loading invite metadata ──────────────────────────────────────────────
    if (metaLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Loading invite…</p>
                </div>
            </div>
        );
    }

    // ── Invalid / expired invite ─────────────────────────────────────────────
    if (metaError || !meta) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white px-6">
                <div className="max-w-sm w-full text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
                    <p className="text-sm text-gray-500 mb-6">
                        {metaError ?? "This invite link is invalid or has expired."}
                    </p>
                    <a href="/" className="text-sm text-primary hover:underline">
                        Go to sign in
                    </a>
                </div>
            </div>
        );
    }

    const roleLabel = meta.role === "admin" ? "Admin" : "Member";

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6 py-12">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
                {/* Logo */}
                <img
                    src="/assets/images/icon_transparent_bg.png"
                    alt="BrainSales"
                    className="h-10 mx-auto mb-6 opacity-80"
                />

                {accepted ? (
                    // ── Success state ────────────────────────────────────────────────
                    <>
                        <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're in!</h1>
                        <p className="text-sm text-gray-500">
                            Welcome to <span className="font-semibold text-gray-700">{meta.organizationName}</span>.
                            Redirecting you now…
                        </p>
                    </>
                ) : accepting ? (
                    // ── Accepting ────────────────────────────────────────────────────
                    <>
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Joining workspace…</h1>
                        <p className="text-sm text-gray-400">Just a second</p>
                    </>
                ) : (
                    // ── Pre-sign-in state ────────────────────────────────────────────
                    <>
                        <UserPlus className="h-12 w-12 text-primary mx-auto mb-4 opacity-80" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're invited!</h1>
                        <p className="text-gray-500 text-sm mb-1">
                            Join <span className="font-semibold text-gray-700">{meta.organizationName}</span> on BrainSales
                        </p>
                        <span className="inline-block mt-2 mb-6 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                            {roleLabel}
                        </span>

                        {meta.email && (
                            <div className="bg-amber-50 border border-amber-100 text-amber-700 text-xs px-4 py-2.5 rounded-xl mb-5">
                                This invite is for <strong>{meta.email}</strong>. Please sign in with that email.
                            </div>
                        )}

                        {acceptError && (
                            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
                                {acceptError}
                            </div>
                        )}

                        {user ? (
                            // Signed in but accept failed — show retry
                            <div>
                                <p className="text-sm text-gray-500 mb-4">
                                    Signed in as <span className="font-medium">{user.email}</span>
                                </p>
                                <button
                                    onClick={() => setAccepting(false)}
                                    className="text-sm text-primary hover:underline"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleSignIn}
                                className="group w-full bg-white border border-gray-200 hover:border-primary/40 hover:shadow-md text-gray-700 font-medium py-3.5 px-5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 shadow-sm"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                <span>Sign in with Google to join</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
