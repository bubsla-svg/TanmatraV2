"use client";

import { usePathname } from "next/navigation";
import { isInternalSurface } from "@/lib/internalSurfaces";

/**
 * InternalSurfaceGate — completely un-renders its children (consumer chrome)
 * on operational/internal routes like /admin.
 */
export function InternalSurfaceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isInternalSurface(pathname)) return null;
  return <>{children}</>;
}
