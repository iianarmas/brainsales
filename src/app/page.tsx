"use client";

import { useAuth } from "@/context/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { CallScreen } from "@/components/CallScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Identifying user..." />;
  }

  if (!user) {
    return <LoginForm />;
  }

  return <CallScreen />;
}
