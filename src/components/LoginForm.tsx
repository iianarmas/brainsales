"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatPhoneNumber } from "@/utils/phoneNumber";
import { Mail, Lock, Loader2, ArrowRight, Key, User, Phone } from "lucide-react";

type AuthMode = "signin" | "signup" | "magic-link";

export function LoginForm() {
  const { signIn, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("+1.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Helper to capitalize first letter
  const capitalizeFirstLetter = (value: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "magic-link") {
        const { error } = await signInWithMagicLink(email);
        if (error) {
          setError(error.message);
        } else {
          setMessage("Check your email for a login link!");
        }
      } else if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        }
      } else {
        // Signup with invite code and profile data via API
        const response = await fetch("/api/auth/signup-with-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            inviteCode,
            firstName,
            lastName,
            companyEmail,
            companyPhone
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "Signup failed");
        } else {
          setMessage(data.message || "Account created! You can now sign in.");
          setMode("signin");
          setInviteCode("");
          setFirstName("");
          setLastName("");
          setCompanyEmail("");
          setCompanyPhone("+1.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary-light to-white px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-primary/10">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="/assets/images/logo_with_text_transparent.png.png"
              alt="BrainSales"
              className="h-24 mx-auto mb-4"
            />
            <p className="text-gray-600">
              Call Flow Assistant
            </p>
          </div>

          {/* Auth Mode Tabs */}
          <div className="flex mb-6 bg-secondary rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "signin"
                  ? "bg-primary text-white shadow active:bg-primary-dark focus:outline-none"
                  : "text-gray-600 hover:text-primary"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "signup"
                  ? "bg-primary text-white shadow active:bg-primary-dark focus:outline-none"
                  : "text-gray-600 hover:text-primary"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setMode("magic-link")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "magic-link"
                  ? "bg-primary text-white shadow active:bg-primary-dark focus:outline-none"
                  : "text-gray-600 hover:text-primary"
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {/* Password Field (not shown for magic link) */}
            {mode !== "magic-link" && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Invite Code Field (only for signup) */}
            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Invite Code
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="inviteCode"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors uppercase"
                      placeholder="Enter invite code"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Contact your administrator for an invite code
                  </p>
                </div>

                {/* First Name */}
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(capitalizeFirstLetter(e.target.value))}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                      placeholder="Enter your first name"
                    />
                  </div>
                </div>

                {/* Last Name */}
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(capitalizeFirstLetter(e.target.value))}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                {/* Company Email */}
                <div>
                  <label
                    htmlFor="companyEmail"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Company Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="companyEmail"
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                      placeholder="your.email@314ecorp.us"
                    />
                  </div>
                </div>

                {/* Company Phone */}
                <div>
                  <label
                    htmlFor="companyPhone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Company Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="companyPhone"
                      type="text"
                      value={companyPhone}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        // Ensure +1. prefix is always present
                        if (formatted.length < 3) {
                          setCompanyPhone("+1.");
                        } else {
                          setCompanyPhone(formatted);
                        }
                      }}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                      placeholder="+1.XXX.XXX.XXXX"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Format: +1.XXX.XXX.XXXX
                  </p>
                </div>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                {message}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30 active:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-lighter"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {mode === "signin" && "Sign In"}
                  {mode === "signup" && "Create Account"}
                  {mode === "magic-link" && "Send Magic Link"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Powered by Chris Armas
          </p>
        </div>
      </div>
    </div>
  );
}
