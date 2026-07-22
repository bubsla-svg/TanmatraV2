import type { Metadata, Viewport } from "next";
// Order matters: tokens define the CSS custom properties, globals maps them to
// Tailwind utilities and sets the document defaults.
import "@workspace/tokens/tokens.css";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: {
    default: "Tanmatra — clinical nutrition, cooked fresh",
    template: "%s · Tanmatra",
  },
  description:
    "RD-designed lunches delivered to your desk. Real food, verified macros, no jargon.",
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  colorScheme: "light",
};

/**
 * Root layout. `data-theme="light"` is rendered on the server, so the correct
 * theme is present in the first byte of HTML — the light theme resolves before
 * first paint with no flash, no client theme script required (Phase 1 ships a
 * single default theme; the dark override exists in tokens for a later toggle).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <Header />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
