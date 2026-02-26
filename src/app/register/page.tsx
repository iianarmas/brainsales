"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Building2, CheckCircle2, Mail } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { isGenericEmailDomain } from "@/lib/genericEmailDomains";
import { Logo } from "@/components/Logo";

export default function RegisterPage() {
    const { user, session } = useAuth();

    const [step, setStep] = useState<"signin" | "form" | "done">("signin");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Magic link state (for sign-in step)
    const [magicEmail, setMagicEmail] = useState("");
    const [magicLoading, setMagicLoading] = useState(false);
    const [magicSent, setMagicSent] = useState(false);

    const [workspaceName, setWorkspaceName] = useState("");
    const [slug, setSlug] = useState("");
    const [domain, setDomain] = useState("");
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    const domainIsGeneric = domain.trim() !== "" && isGenericEmailDomain(domain.trim());

    // If user is already signed in via Google, skip the sign-in step
    useEffect(() => {
        if (user) {
            setStep("form");
            // Pre-fill domain if they have a corporate email
            const email = user.email ?? "";
            const emailDomain = email.split("@")[1] ?? "";
            const genericDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "me.com", "live.com"];
            if (!genericDomains.includes(emailDomain)) {
                setDomain(emailDomain);
            }
        }
    }, [user]);

    // Auto-generate slug from workspace name
    const handleNameChange = (val: string) => {
        setWorkspaceName(val);
        if (!slugManuallyEdited) {
            setSlug(
                val
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-")
                    .slice(0, 40)
            );
        }
    };

    const handleSignInWithGoogle = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: typeof window !== "undefined"
                    ? `${window.location.origin}/register`
                    : undefined,
            },
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!magicEmail.trim()) return;
        setMagicLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOtp({
            email: magicEmail.trim().toLowerCase(),
            options: {
                // Redirect back to /register so they land on the workspace form
                emailRedirectTo: typeof window !== "undefined"
                    ? `${window.location.origin}/register`
                    : undefined,
                shouldCreateUser: true,
            },
        });
        if (error) {
            setError(error.message);
        } else {
            setMagicSent(true);
        }
        setMagicLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.access_token) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/organizations/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    workspaceName: workspaceName.trim(),
                    slug: slug.trim(),
                    domain: domain.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Something went wrong. Please try again.");
                return;
            }

            setStep("done");
        } catch {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row bg-white">
            {/* Left Panel */}
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-primary" />
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_40%,white_1px,transparent_1px)] bg-[length:24px_24px]" />
                <div className="absolute top-12 left-10 w-20 h-20 bg-white/10 rounded-full blur-sm z-10" />
                <div className="absolute bottom-20 left-16 w-14 h-14 bg-white/5 rounded-full blur-xs z-10" />
                <div className="absolute top-1/2 right-8 w-10 h-10 bg-white/10 rounded-full z-10" />

                <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 py-8">
                    <Building2 className="w-16 h-16 text-white/60 mb-6" />
                    <h2 className="text-white text-2xl font-semibold mb-3 text-center">
                        Create your workspace
                    </h2>
                    <p className="text-white/50 text-sm leading-relaxed text-center max-w-xs">
                        Set up your team's workspace in minutes. Invite your teammates once your account is approved.
                    </p>

                    <div className="mt-12 space-y-4 w-full max-w-xs">
                        {[
                            "Sign in with Google",
                            "Set up your workspace",
                            "Await approval",
                            "Employees sign in — no invites needed",
                        ].map((label, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                    {i + 1}
                                </div>
                                <span className="text-white/70 text-sm">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 lg:py-12">
                <div className="w-full max-w-sm">
                    {/* Logo */}
                    <div className="mb-8">
                        <Logo className="h-12 w-auto" />
                        <h2 className="text-lg font-bold text-primary mt-1">BrainSales</h2>
                    </div>

                    {/* Step: Sign in first */}
                    {step === "signin" && (
                        <>
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                    Create a workspace
                                </h1>
                                <p className="mt-2 text-gray-400 text-sm">
                                    First, sign in to continue.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-5 border border-red-100">
                                    {error}
                                </div>
                            )}

                            {magicSent ? (
                                <div className="text-center py-2">
                                    <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                                    <h2 className="text-base font-semibold text-gray-900 mb-2">Check your email</h2>
                                    <p className="text-sm text-gray-500 mb-4">
                                        We sent a sign-in link to{" "}
                                        <span className="font-medium text-gray-700">{magicEmail}</span>.
                                        Click it to continue setting up your workspace.
                                    </p>
                                    <button
                                        onClick={() => { setMagicSent(false); setMagicEmail(""); }}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Use a different email
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Google */}
                                    <button
                                        onClick={handleSignInWithGoogle}
                                        disabled={loading || magicLoading}
                                        className="group w-full bg-white border border-gray-200 hover:border-primary/40 hover:shadow-lg text-gray-700 font-medium py-4 px-5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        ) : (
                                            <>
                                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                </svg>
                                                <span>Continue with Google</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Divider */}
                                    <div className="flex items-center gap-3 my-5">
                                        <div className="flex-1 h-px bg-gray-100" />
                                        <span className="text-xs text-gray-400">or</span>
                                        <div className="flex-1 h-px bg-gray-100" />
                                    </div>

                                    {/* Magic link */}
                                    <form onSubmit={handleMagicLink} className="space-y-3">
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                type="email"
                                                value={magicEmail}
                                                onChange={(e) => setMagicEmail(e.target.value)}
                                                placeholder="Enter your email address"
                                                required
                                                className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={magicLoading || loading || !magicEmail.trim()}
                                            className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3.5 px-5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {magicLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                "Send sign-in link"
                                            )}
                                        </button>
                                    </form>

                                    <p className="mt-6 text-center text-xs text-gray-400">
                                        Already have an account?{" "}
                                        <a href="/" className="text-primary hover:underline">Sign in</a>
                                    </p>
                                </>
                            )}
                        </>
                    )}

                    {/* Step: Workspace form */}
                    {step === "form" && (
                        <>
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                    Set up your workspace
                                </h1>
                                <p className="mt-2 text-gray-400 text-sm">
                                    Signed in as <span className="font-medium text-gray-600">{user?.email}</span>
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-5 border border-red-100">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Workspace name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={workspaceName}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        placeholder="Acme Corp"
                                        required
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Workspace URL <span className="text-red-400">*</span>
                                    </label>
                                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition">
                                        <span className="px-3 py-3 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 shrink-0">
                                            workspace/
                                        </span>
                                        <input
                                            type="text"
                                            value={slug}
                                            onChange={(e) => {
                                                setSlugManuallyEdited(true);
                                                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                                            }}
                                            placeholder="acme-corp"
                                            required
                                            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                            className="flex-1 px-3 py-3 text-sm focus:outline-none bg-white"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-400">Lowercase letters, numbers, and hyphens only.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Company email domain{" "}
                                        <span className="text-gray-400 font-normal">(optional)</span>
                                    </label>
                                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition">
                                        <span className="px-3 py-3 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 shrink-0">@</span>
                                        <input
                                            type="text"
                                            value={domain}
                                            onChange={(e) => setDomain(e.target.value.toLowerCase())}
                                            placeholder="acme.com"
                                            className="flex-1 px-3 py-3 text-sm focus:outline-none bg-white"
                                        />
                                    </div>
                                    {domainIsGeneric ? (
                                        <div className="mt-2 flex items-start gap-2 bg-red-50 text-red-600 text-xs px-3 py-2.5 rounded-lg border border-red-100">
                                            <svg className="h-3.5 w-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>
                                                <strong>{domain}</strong> is a public email provider. Anyone in the world with that address could join your workspace.
                                                Leave this blank and invite teammates manually instead.
                                            </span>
                                        </div>
                                    ) : domain ? (
                                        <div className="mt-2 flex items-start gap-2 bg-green-50 text-green-700 text-xs px-3 py-2.5 rounded-lg border border-green-100">
                                            <svg className="h-3.5 w-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>
                                                Anyone with an <strong>@{domain}</strong> email can sign in automatically — no invite links needed.
                                            </span>
                                        </div>
                                    ) : (
                                        <p className="mt-1.5 text-xs text-gray-400">
                                            Add your company domain so employees can sign in via Google SSO automatically.
                                            Leave blank if your team uses personal email — you&apos;ll invite them manually instead.
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !workspaceName || !slug || domainIsGeneric}
                                    className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 px-5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        "Create Workspace"
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step: Done / pending approval */}
                    {step === "done" && (
                        <div className="text-center">
                            <div className="flex justify-center mb-5">
                                <CheckCircle2 className="w-14 h-14 text-green-500" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-3">
                                Workspace created!
                            </h1>
                            <p className="text-gray-500 text-sm leading-relaxed mb-6">
                                Your workspace <span className="font-semibold text-gray-700">{workspaceName}</span> is pending approval.
                                We'll review it shortly — you'll be able to sign in once it's activated.
                            </p>
                            <p className="text-xs text-gray-400">
                                Questions? Contact{" "}
                                <a href="mailto:support@brainsales.ai" className="text-primary hover:underline">
                                    support@brainsales.ai
                                </a>
                            </p>
                        </div>
                    )}

                    <div className="mt-12 pt-6 border-t border-gray-100">
                        <p className="text-center text-xs text-gray-300">By Chris Armas</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
