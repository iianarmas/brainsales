"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/context/ProductContext";
import { LoginForm } from "@/components/LoginForm";
import { CallScreen } from "@/components/CallScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Clock } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Home() {
  const { user, loading: authLoading, authStatus, signOut, isAdmin, isSuperAdmin } = useAuth();
  const { products, loading: productsLoading } = useProduct();
  const router = useRouter();

  const loading = authLoading || (user && productsLoading);

  // Clean up hash fragment left by Supabase OAuth flow (e.g. brainsales.tech/#access_token=... or brainsales.tech/#)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#' || hash.startsWith('#access_token')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (user && !authLoading && !productsLoading && authStatus === 'authenticated' && isAdmin && !isSuperAdmin && products.length === 0) {
      router.replace("/admin/products");
    }
  }, [user, authLoading, productsLoading, authStatus, isAdmin, isSuperAdmin, products.length, router]);

  if (loading) {
    return <LoadingScreen fullScreen={true} message="Identifying user..." />;
  }

  if (!user) {
    return <LoginForm />;
  }

  // User is signed in but their workspace is awaiting approval
  if (authStatus === "pending_approval") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-sm w-full text-center">
          <Logo className="h-10 mx-auto mb-6 opacity-80" />
          <Clock className="h-12 w-12 text-primary mx-auto mb-4 opacity-70" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Pending Approval
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Your workspace is being reviewed. You&apos;ll be able to sign in as soon as it&apos;s approved. Check back shortly.
          </p>
          <p className="text-xs text-gray-400">
            Signed in as{" "}
            <span className="font-medium text-gray-600">{user.email}</span>
          </p>
          <button
            onClick={signOut}
            className="mt-4 text-xs text-primary hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <CallScreen />;
}
