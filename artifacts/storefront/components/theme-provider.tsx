"use client";
// Client: next-themes reads/writes localStorage + the document attribute, which
// only exists in the browser — the theme provider must hydrate on the client.

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme provider (TNM-UIF-01 §3.3). Light is the default per IMPECCABLE §3.3 /
 * master-index §7.6; dark is an opt-in toggle. We use the `data-theme` attribute
 * strategy (not the `.dark` class) to match the existing @workspace/tokens,
 * whose dark palette is keyed off `:root[data-theme="dark"]`. Components stay
 * theme-blind — they read semantic tokens only, never `dark:` forks.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
