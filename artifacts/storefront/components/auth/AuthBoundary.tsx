"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Phase 2 scaffolding: check auth state (mocked)
    const token = localStorage.getItem("tnm_session");
    if (!token) {
      sessionStorage.setItem("tnm_return_route", pathname);
      router.replace("/login");
    } else {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, [pathname, router]);

  if (isChecking) {
    return <div className="min-h-screen bg-bg" />; // Neutral loading
  }

  return isAuthenticated ? <>{children}</> : null;
}
