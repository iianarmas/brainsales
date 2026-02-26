"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { Logo } from "./Logo";

function getInitialError(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const errorParam = params.get("error");
  if (!errorParam) return null;
  window.history.replaceState({}, "", "/");
  if (errorParam === "unauthorized_domain") {
    return "Your email isn't authorized for any workspace. Register your workspace or ask your admin for an invite link.";
  }
  return "Sign in failed. Please try again.";
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export function LoginForm() {
  const { signInWithGoogle } = useAuth();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(getInitialError);

  // Magic link state
  const [email, setEmail] = useState("");
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setMagicLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        shouldCreateUser: false, // don't auto-create — must already have an org membership
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
    setMagicLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-primary" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_40%,white_1px,transparent_1px)] bg-[length:24px_24px]" />
        <div className="absolute top-12 left-10 w-20 h-20 bg-white/10 rounded-full blur-sm z-10" />
        <div className="absolute top-1/4 right-8 w-10 h-10 bg-primary-lighter/30 rounded-full z-10" />
        <div className="absolute bottom-20 left-16 w-14 h-14 bg-white/5 rounded-full blur-xs z-10" />
        <div className="absolute bottom-1/3 right-14 w-6 h-6 bg-secondary/20 rounded-full z-10" />
        <div className="absolute top-1/2 left-6 w-4 h-4 bg-white/20 rounded-full z-10" />
        <div className="absolute bottom-12 right-1/3 w-8 h-8 border border-white/15 rounded-full z-10" />

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 py-8">
          <div className="text-center mb-6">
            <p className="text-white/70 text-sm font-bold tracking-widest uppercase">
              Call Flow Assistant
            </p>
          </div>
          <div className="w-full max-w-3xl relative">
            <div className="absolute inset-4 bg-white/10 rounded-3xl blur-2xl" />
            <div className="relative bg-white/10 backdrop-blur-sm border border-white/15 rounded-3xl p-6 shadow-2xl">
              <img
                src="/assets/images/login_image.png"
                alt="BrainSales platform"
                className="w-full object-contain rounded-2xl"
              />
            </div>
          </div>
          <div className="mt-8 text-center max-w-md">
            <h2 className="text-white text-2xl font-semibold mb-3">
              Smarter Sales, Powered by AI
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Streamline your call flows, boost conversions, and close deals
              faster with intelligent automation.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Hero Banner */}
      <div className="lg:hidden relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-primary" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_40%,white_1px,transparent_1px)] bg-[length:24px_24px]" />
        <div className="absolute top-4 right-6 w-12 h-12 bg-white/10 rounded-full blur-sm" />
        <div className="absolute bottom-6 left-8 w-8 h-8 bg-primary-lighter/30 rounded-full" />
        <div className="relative z-10 px-6 pt-10 pb-8 flex flex-col items-center">
          <img
            src="/assets/images/login_image.png"
            alt="BrainSales platform"
            className="w-full max-w-xs object-contain rounded-2xl mb-4"
          />
          <p className="text-white/60 text-xs font-bold tracking-widest uppercase">
            Call Flow Assistant
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 lg:py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Logo className="h-12 w-auto" />
            <h2 className="text-lg md:text-xl font-bold text-primary">BrainSales</h2>
          </div>

          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back</h1>
            <p className="mt-2 text-gray-400 text-sm">Sign in to continue to BrainSales</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-6 border border-red-100 flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {magicSent ? (
            /* ── Magic link sent confirmation ── */
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-4">
                We sent a sign-in link to <span className="font-medium text-gray-700">{email}</span>.
                Click it to sign in — no password needed.
              </p>
              <button
                onClick={() => { setMagicSent(false); setEmail(""); }}
                className="text-xs text-primary hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading || magicLoading}
                className="group w-full bg-white border border-gray-200 hover:border-primary/40 hover:shadow-lg text-gray-700 font-medium py-4 px-5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <>
                    <GoogleIcon />
                    <span className="group-hover:text-gray-900 transition-colors">
                      Sign in with Google
                    </span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Magic Link */}
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={magicLoading || googleLoading || !email.trim()}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3.5 px-5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {magicLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send sign-in link"
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-gray-400">
                Don&apos;t have a workspace?{" "}
                <a href="/register" className="text-primary hover:underline font-medium">
                  Register here
                </a>{" "}
                or ask your admin for an invite link.
              </p>
            </>
          )}

          <div className="mt-12 pt-6 border-t border-gray-100">
            <p className="text-center text-xs text-gray-300">By Chris Armas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
