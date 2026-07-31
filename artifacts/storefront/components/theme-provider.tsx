"use client";
// Client: next-themes reads/writes localStorage + the document attribute, which
// only exists in the browser — the theme provider must hydrate on the client.

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme provider (TNM-UIF-01 §3.3). Light is the fallback when a user has
 * expressed no preference (no stored choice, no OS signal) per IMPECCABLE
 * §3.3 / master-index §7.6; dark is available both as an explicit toggle
 * (Header's ThemeToggle) and, with `enableSystem`, as the OS-driven default —
 * a user who set `prefers-color-scheme: dark` for photosensitivity or
 * eye-strain reasons gets it without having to find a toggle first. We use
 * the `data-theme` attribute strategy (not the `.dark` class) to match the
 * existing @workspace/tokens, whose dark palette is keyed off
 * `:root[data-theme="dark"]`. Components stay theme-blind — they read
 * semantic tokens only, never `dark:` forks. next-themes injects its own
 * blocking pre-paint script (the same zero-flash mechanism as
 * STITCH_ROUTE_SCRIPT in app/layout.tsx), so enabling the system read here
 * costs no extra flash — it's already reading localStorage before paint.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
