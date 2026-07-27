import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
// Order matters: tokens define the CSS custom properties, globals maps them to
// Tailwind utilities and sets the document defaults.
import "@workspace/tokens/tokens.css";
// Astryx base component CSS (StyleX output): Grid's columns, Stack's gaps,
// Card/AspectRatio geometry. The theme file below only OVERRIDES these —
// without the base, Astryx components render unstyled (a one-column grid was
// how this surfaced). Order: base → theme → our globals.
import "@astryxdesign/core/astryx.css";
import "@/lib/themes/tanmatra.css";
// Value-pinned token bridge — MUST come after the two Astryx sheets so its
// unlayered :root[data-astryx-theme] block outranks their layered defaults.
import "@/lib/themes/tanmatraBridge.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/components/cart/CartProvider";
import { MiniCartBar } from "@/components/cart/MiniCartBar";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { SiteStructuredData } from "@/components/StructuredData";
import { SITE_URL } from "@/lib/siteUrl";
import { PostHogProvider } from "@/components/PostHogProvider";


// TNM-UIF-01 §10.2: IBM Plex Sans (UI) + JetBrains Mono (macro/numeric data).
// next/font self-hosts the files and exposes each as a CSS variable that
// globals.css folds into --font-sans / --font-mono.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const TITLE = "Tanmatra — clinical nutrition, cooked fresh";
const DESCRIPTION =
  "RD-designed lunches delivered to your desk. Real food, verified macros, no jargon.";

export const metadata: Metadata = {
  // Absolute base for canonical + OpenGraph URLs. Env-overridable once a real
  // marketing domain is in front of the service (see lib/siteUrl.ts).
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Tanmatra",
  },
  description: DESCRIPTION,
  applicationName: "Tanmatra",
  openGraph: {
    type: "website",
    siteName: "Tanmatra",
    locale: "en_IN",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
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
    <html
      lang="en"
      data-theme="light"
      // Astryx scopes its theme with `@scope ([data-astryx-theme="tanmatra"])`,
      // so this attribute is what makes --color-* resolve. On <html> the whole
      // document is in scope and the tokens inherit everywhere.
      data-astryx-theme="tanmatra"
      suppressHydrationWarning
      className={`${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="pb-16 md:pb-0">
        <SiteStructuredData />
        <PostHogProvider>
          <ThemeProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-gold focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--gold-ink)]"
            >
              Skip to main content
            </a>
            <CartProvider>
              <Header />
              <main id="main">{children}</main>
              {/* §4.1/§4.3: persistent mini-cart bar once the cart is non-empty. */}
              <MiniCartBar />
              <Footer />
              <BottomNav />
            </CartProvider>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
