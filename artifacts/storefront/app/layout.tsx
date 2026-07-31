import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
// FIRST, always. A bare @layer statement that fixes the cascade-layer order;
// layer rank is set at first declaration, so this has to be declared before any
// sheet that opens a layer. Without it Tailwind's Preflight (declared last, via
// globals.css) outranked Astryx's base layer and its `*{padding:0}` reset ate
// every Astryx padding — see app/layers.css for the full account.
import "./layers.css";
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
// The Stitch dark scope — one `color-scheme: dark` declaration. It used to be
// imported by each of the ~15 redesigned pages; it is imported ONCE here now,
// because the attribute it targets is stamped on <html> by STITCH_ROUTE_SCRIPT
// below and so applies on every route, not only the ones that happened to pull
// the sheet in.
import "@/lib/themes/stitch.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/components/cart/CartProvider";
import { MiniCartBar } from "@/components/cart/MiniCartBar";
import { Footer } from "@/components/Footer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SiteStructuredData } from "@/components/StructuredData";
import { ChromeGate } from "@/components/ChromeGate";
import { NetworkStatusToast } from "@/components/NetworkStatusToast";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { QueryProvider } from "@/components/QueryProvider";
import { SITE_URL } from "@/lib/siteUrl";
import { PostHogProvider } from "@/components/PostHogProvider";
import {
  THEME_COLOR,
  STITCH_EXACT_ROUTES,
  STITCH_PREFIX_ROUTES,
} from "@/lib/stitchRoutes";

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

// NO colorScheme here — the root color-scheme is driven by CSS off
// html[data-stitch="dark"] (lib/themes/stitch.css), not by this export; see
// the RootLayout doc comment for why. themeColor stays: it is the static
// LIGHT default that STITCH_ROUTE_SCRIPT below flips for dark routes by
// mutating the rendered <meta> tag's content before paint — it has to exist
// in the DOM already for that mutation to have something to find.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEME_COLOR.light,
  // Without this, env(safe-area-inset-*) resolves to 0 on notched/Dynamic-Island
  // devices, silently no-op'ing the app's .pb-safe/.mb-safe CSS and the fixed
  // MobileBottomNav bottom-padding calc — see docs/WEB-APP-ENHANCEMENT-PLAN.md.
  viewportFit: "cover",
};

/**
 * Inline guard script, `beforeInteractive` (next/script): Next injects this
 * into the initial HTML and runs it before hydration, before the browser
 * paints anything — the same zero-flash mechanism next-themes already uses
 * in this codebase (components/theme-provider.tsx) for `data-theme`. It
 * matches `location.pathname` against the two arrays lib/stitchRoutes.ts
 * exports (serialised here, not hand-copied, so the two cannot drift) and,
 * for a dark route, stamps `data-stitch="dark"` on <html> and repoints the
 * theme-color meta to the dark canvas colour.
 *
 * WHY <html> AND NOT <body>: a stylesheet rule can watch for the attribute
 * anywhere: `[data-stitch="dark"] { color-scheme: dark !important }`
 * (lib/themes/stitch.css) applies identically regardless of which element
 * carries it. <html> is a strict superset of <body> as a scope root — it is
 * still an ancestor of the chrome AND of Radix portals (which mount on
 * document.body, itself inside <html>) — and putting it there means the
 * script can run from <head>, before <body> exists at all, which is the
 * earliest and safest place to avoid any paint of the wrong colour.
 *
 * WHY A SCRIPT AND NOT A SERVER COMPONENT: see lib/stitchRoutes.ts's file
 * header — the server-side version of this fix (reading the path via
 * `headers()` in this layout) is flash-free too, but `headers()` is a
 * dynamic API and calling it here forces the ENTIRE app out of static
 * rendering. Measured: 50 statically prerendered routes dropped to 2.
 */
const STITCH_ROUTE_SCRIPT = `(function () {
  try {
    var EXACT = ${JSON.stringify(STITCH_EXACT_ROUTES)};
    var PREFIXES = ${JSON.stringify(STITCH_PREFIX_ROUTES)};
    var path = String(location.pathname).split(/[?#]/)[0] || "";
    if (path.length > 1 && path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
    var dark = EXACT.indexOf(path) !== -1;
    if (!dark) {
      for (var i = 0; i < PREFIXES.length; i++) {
        var p = PREFIXES[i];
        if (path.indexOf(p) === 0 && path.length > p.length) { dark = true; break; }
      }
    }
    if (dark) {
      document.documentElement.setAttribute("data-stitch", "dark");
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", ${JSON.stringify(THEME_COLOR.dark)});
    }
  } catch (e) {}
})();`;

/**
 * Root layout. `data-theme="light"` is the server-rendered fallback — correct
 * for a visitor with no stored preference and no dark OS signal, so the first
 * byte of HTML is right without waiting on the client. A visitor whose OS
 * prefers dark, or who has toggled dark before (Header's ThemeToggle), needs
 * next-themes' own beforeInteractive script to flip `data-theme` to "dark"
 * before paint — same zero-flash mechanism as STITCH_ROUTE_SCRIPT below, just
 * shipped by the next-themes package instead of hand-rolled here.
 *
 * `data-stitch="dark"` is the other half of that: the total-redesign routes
 * (lib/stitchRoutes.ts) render on the dark arm of every token, and the
 * attribute has to sit ABOVE the chrome for the header/footer/bottom-nav to
 * agree with the page — they render here, outside `children`, so a per-page
 * wrapper could never reach them. Unlike `data-theme`, this attribute is not
 * rendered server-side (this layout has no server-side view of the route,
 * deliberately — see STITCH_ROUTE_SCRIPT above) — STITCH_ROUTE_SCRIPT stamps
 * it on <html> before first paint instead.
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
      <body
        // Paints the canvas itself so there is no unpainted gap between the
        // chrome and a page that no longer carries its own bg. --bg/--ink
        // resolve correctly here even though this element has no data-stitch
        // of its own — color-scheme is inherited, and STITCH_ROUTE_SCRIPT set
        // it on <html> above before this element was even parsed.
        //
        // The bottom padding clears the mobile bottom nav, which is 64px PLUS
        // env(safe-area-inset-bottom). A flat pb-16 (64px) left the last card
        // on /menu and /plans cut off on a notched phone with nothing left to
        // scroll — the mini-cart bar sits above the nav and adds ~69px more.
        className="bg-[var(--bg)] text-ink pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        <Script id="stitch-route-scope" strategy="beforeInteractive">
          {STITCH_ROUTE_SCRIPT}
        </Script>
        <SiteStructuredData />
        <PostHogProvider>
          <QueryProvider>
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
                <MobileBottomNav />
                {/* Honest offline state — the service worker never serves a
                  cached /checkout, /account or /api response, so a dropped
                  connection has to be visible rather than silent. */}
                <NetworkStatusToast />
                <ServiceWorkerRegistrar />
              </CartProvider>
            </ThemeProvider>
          </QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
