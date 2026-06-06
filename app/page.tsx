"use client";

import { useEffect } from "react";
import { useDrm } from "./context/DrmContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { currentProfile, isLoading } = useDrm();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (currentProfile) {
        if (currentProfile.onboarding_completed) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } else {
        router.push("/login");
      }
    }
  }, [currentProfile, isLoading, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
    </div>
  );
}
