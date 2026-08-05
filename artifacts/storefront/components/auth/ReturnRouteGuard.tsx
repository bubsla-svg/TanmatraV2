"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ReturnRouteGuard
 * To be wrapped around the login/auth completion steps.
 * Routes the user back to their original destination after successful auth.
 */
export function ReturnRouteGuard({ children, isAuthenticated }: { children: React.ReactNode, isAuthenticated: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      const returnRoute = sessionStorage.getItem("tnm_return_route");
      if (returnRoute) {
        sessionStorage.removeItem("tnm_return_route");
        router.replace(returnRoute);
      } else {
        router.replace("/"); // default to home
      }
    }
  }, [isAuthenticated, router]);

  return <>{children}</>;
}
