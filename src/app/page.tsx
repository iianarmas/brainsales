"use client";

import { useAuth } from "@/context/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { CallScreen } from "@/components/CallScreen";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <CallScreen />;
}
