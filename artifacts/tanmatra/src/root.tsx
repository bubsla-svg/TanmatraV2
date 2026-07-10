import { useEffect, type ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useMatches, useLocation } from "react-router";
import type { LinksFunction, MetaFunction } from "react-router";
import { API_BASE } from "@/lib/apiBase";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cartContext";
import { ThemeManager } from "@/lib/clinicalTheme";
import { ThemeProvider } from "next-themes";
import { OrdersProvider } from "@/lib/ordersContext";
import { PreferencesProvider } from "@/lib/preferencesContext";
import OnboardingQuizGate from "@/components/preferences/OnboardingQuizGate";
import SoftGate from "@/components/onboarding/SoftGate";
import Header from "@/components/layout/Header";
import WelcomeOfferBanner from "@/components/marketing/WelcomeOfferBanner";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import BottomDock from "@/components/layout/BottomDock";
import ScrollToTop from "@/components/layout/ScrollToTop";
import StickyCheckoutBar from "@/components/cart/StickyCheckoutBar";
import CartDrawer from "@/components/cart/CartDrawer";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { installErrorTelemetry } from "@/lib/errorTelemetry";
import "./index.css";
import "./tanmatra-v2/theme.css";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://images.unsplash.com" },
  // Phosphor icon weights for the v2 screens (self-hosted under /public).
  { rel: "stylesheet", href: "/phosphor/regular/style.css" },
  { rel: "stylesheet", href: "/phosphor/fill/style.css" },
  { rel: "stylesheet", href: "/phosphor/bold/style.css" },
  // Critical font — Inter Variable latin subset is the first face the browser
  // needs. Without this hint it discovers the URL only after CSS is parsed.
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    href: "/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2",
    crossOrigin: "anonymous",
  },
  // PWA manifest — enables "Add to Home Screen" prompt on Android Chrome.
  { rel: "manifest", href: "/manifest.webmanifest" },
];

export const meta: MetaFunction = () => [
  { title: "Tanmatra — Therapeutic Meal Delivery" },
  { name: "description", content: "Clinical-grade therapeutic meals designed by registered dietitians. Browse the curated menu, build personalised weekly plans, and track wellness, performance, and clinical protocols." },
  { name: "theme-color", content: "#050505" },
  { property: "og:type", content: "website" },
  { property: "og:site_name", content: "Tanmatra" },
  { property: "og:title", content: "Tanmatra — Therapeutic Meal Delivery" },
  { property: "og:description", content: "Clinical-grade therapeutic meals designed by registered dietitians. Curated menu, personalised plans, wellness tracking." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Tanmatra — Therapeutic Meal Delivery" },
  { name: "twitter:description", content: "Clinical-grade therapeutic meals designed by registered dietitians." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
];

const queryClient = new QueryClient();

// Report a single Core Web Vital to the API for server-side aggregation.
// keepalive: true ensures the beacon fires even on page unload/navigation.
function sendVital(name: string, value: number, id: string): void {
  try {
    navigator.sendBeacon(
      `${API_BASE}/vitals`,
      JSON.stringify({ name, value, id, url: location.pathname, ts: Date.now() }),
    );
  } catch {
    // Non-critical — never throw from a perf observer callback.
  }
}

if (typeof window !== "undefined") {
  installErrorTelemetry();
}

// Lazy-import web-vitals so it never blocks the critical render path.
if (typeof window !== "undefined") {
  import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    onCLS((m) => sendVital(m.name, m.value, m.id));
    onFCP((m) => sendVital(m.name, m.value, m.id));
    onINP((m) => sendVital(m.name, m.value, m.id));
    onLCP((m) => sendVital(m.name, m.value, m.id));
    onTTFB((m) => sendVital(m.name, m.value, m.id));
  }).catch(() => { /* web-vitals unavailable — silently ignore */ });
}

const LOADER_STYLE = `
  #__tanmatra-loader {
    position: fixed; inset: 0; z-index: 9999;
    background: #050505;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 20px;
  }
  #__tanmatra-loader.hidden { display: none; }
  .__tl-wordmark { color: #F4C430; font-size: 1.25rem; font-weight: 600; letter-spacing: 0.08em; font-family: serif; }
  .__tl-sub { color: #A1A1AA; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.12em; }
  .__tl-bar { width: 120px; height: 2px; background: #111114; border-radius: 2px; overflow: hidden; }
  .__tl-bar-inner { height: 100%; width: 0%; background: #F4C430; animation: __tl-slide 1.4s ease-in-out infinite; }
  @keyframes __tl-slide { 0%{width:0%;margin-left:0} 50%{width:60%;margin-left:20%} 100%{width:0%;margin-left:100%} }
  .__tl-retry { display: none; margin-top: 8px; background: transparent; border: 1px solid #F4C430; color: #F4C430;
    padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; }
`.trim();

const LOADER_SCRIPT = `
  (function(){
    var t = setTimeout(function(){
      var r = document.getElementById('__tl-retry');
      if(r) r.style.display='block';
    }, 7000);
    var autoDismiss = setTimeout(function(){
      var el = document.getElementById('__tanmatra-loader');
      if(el){ el.classList.add('hidden'); setTimeout(function(){ el.remove(); }, 300); }
    }, 15000);
    window.__clearTanmatraLoader = function(){
      clearTimeout(t);
      clearTimeout(autoDismiss);
      var el = document.getElementById('__tanmatra-loader');
      if(el){ el.classList.add('hidden'); setTimeout(function(){ el.remove(); }, 300); }
    };
  })();
`.trim();

/**
 * Shared document shell. React Router renders this around the route tree,
 * the HydrateFallback, AND the generated __spa-fallback.html — so every
 * non-prerendered route now ships a real <head> (root meta: title,
 * description, OG, robots), the branded splash, and a useful <noscript>
 * instead of a bare "Loading...".
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Meta />
        <Links />
        {/* Inline loader styles so they apply before any stylesheet downloads */}
        <style dangerouslySetInnerHTML={{ __html: LOADER_STYLE }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FoodEstablishment",
              "name": "Tanmatra",
              "description": "Clinical-grade therapeutic meal delivery designed by registered dietitians.",
              "url": "https://tanmatra.food",
              "logo": "https://tanmatra.food/tanmatra-logo.png",
              "servesCuisine": ["Indian", "Mediterranean", "Therapeutic"],
              "priceRange": "₹₹",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Bengaluru",
                "addressRegion": "Karnataka",
                "addressCountry": "IN"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "email": "care@tanmatra.health",
                "telephone": "+918047019200"
              }
            })
          }}
        />
      </head>
      <body>
        {/* A1c: branded splash shown immediately; cleared by entry.client.tsx on hydration */}
        <div id="__tanmatra-loader" aria-hidden="true">
          <span className="__tl-wordmark">Tanmatra</span>
          <span className="__tl-sub">Clinical Nutrition</span>
          <div className="__tl-bar"><div className="__tl-bar-inner" /></div>
          <button id="__tl-retry" className="__tl-retry" onClick={() => window.location.reload()}>
            Tap to retry
          </button>
        </div>
        <noscript>
          <div style={{ minHeight:"100vh", background:"#050505", color:"#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"12px", fontFamily:"sans-serif", textAlign:"center", padding:"24px" }}>
            <strong style={{ color:"#F4C430", fontSize:"1.25rem" }}>Tanmatra</strong>
            <p style={{ color:"#A1A1AA", fontSize:"0.875rem", maxWidth:"320px" }}>
              Therapeutic meals designed by registered dietitians, delivered fresh
              across Noida, Delhi &amp; Gurgaon. This app needs JavaScript — or reach
              us directly:
            </p>
            <p style={{ fontSize:"0.875rem" }}>
              <a href="mailto:care@tanmatra.health" style={{ color:"#F4C430" }}>care@tanmatra.health</a>
            </p>
            <p style={{ color:"#A1A1AA", fontSize:"0.8125rem", maxWidth:"320px" }}>
              <a href="/menu" style={{ color:"#F4C430" }}>Menu</a>
              {" · "}
              <a href="/plans" style={{ color:"#F4C430" }}>Meal plans</a>
              {" · "}
              <a href="/faq" style={{ color:"#F4C430" }}>FAQ</a>
              {" · "}
              <a href="/refunds" style={{ color:"#F4C430" }}>Refunds</a>
            </p>
          </div>
        </noscript>
        {children}
        <ScrollRestoration />
        <script dangerouslySetInnerHTML={{ __html: LOADER_SCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Rendered (inside Layout) while a non-prerendered route hydrates, and
 * baked into __spa-fallback.html at build. The branded splash + noscript
 * live in Layout, so nothing extra is needed here.
 */
export function HydrateFallback() {
  return null;
}

export default function Root() {
  useEffect(() => {
    window.__clearTanmatraLoader?.();
  }, []);

  const matches = useMatches();
  const hideChrome = matches.some((m) => (m.handle as { chrome?: boolean } | null)?.chrome === false);
  // The Phase 1 soft-gate is top-of-funnel: it must show on the (chrome-less v2)
  // browse routes a new visitor lands on — home and menu — but never during a
  // transaction (checkout/track) or on admin/auth routes. It cannot be gated on
  // !hideChrome, because the whole v2 app is chrome-less.
  const currentPath = useLocation().pathname;
  const softGateRoute = currentPath === "/" || currentPath === "/menu";

  // V2 persistent bottom dock — mirrors the SoftGate route-conditional mount.
  // It rides only on the primary BROWSE/dashboard routes and must never collide
  // with a transaction screen's own sticky pay/action bar. Deny-list guards the
  // transaction/auth/admin surfaces (checkout/cart/track/login/admin); the
  // allow-list keeps unknown deep transaction paths hidden by default.
  const dockHidden = ["/checkout", "/cart", "/track", "/login", "/admin"].some(
    (deny) => currentPath === deny || currentPath.startsWith(deny + "/"),
  );
  const dockShown = ["/menu", "/wellness", "/subscriptions", "/orders", "/account", "/recipes", "/challenges"].some(
    (root) => currentPath === root || currentPath.startsWith(root + "/"),
  );
  const showDock = !dockHidden && (currentPath === "/" || dockShown);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <CartProvider>
                  <OrdersProvider>
                    <PreferencesProvider>
                      <ThemeManager />
                      <ScrollToTop />
                      <div
                        className={`min-h-screen flex flex-col transition-colors duration-200 ${
                          hideChrome ? "text-foreground" : "bg-background text-foreground"
                        }`}
                        style={hideChrome ? { background: "#0A0C0D" } : undefined}
                      >
                        {!hideChrome && <Header />}
                        {!hideChrome && <WelcomeOfferBanner />}
                        {!hideChrome && <OnboardingQuizGate />}
                        {/* Phase 1 soft gate — first-touch, fixed overlay (no
                            CLS). Shows on the home/menu browse routes (which are
                            chrome-less v2), never during checkout/track. */}
                        {softGateRoute && <SoftGate />}
                        {/* On chrome-less v2 routes the bottom nav is hidden, so drop
                            its pb-20 spacer — otherwise it paints a light band below
                            the dark .tnm2 content. */}
                        <main
                          className={hideChrome ? "flex-1" : "flex-1 pb-20 md:pb-0"}
                          // Reserve clearance so the fixed V2 dock never covers the
                          // last row. Static per-route value → no layout shift (CLS-safe).
                          style={showDock ? { paddingBottom: "calc(60px + var(--safe-bottom, 0px))" } : undefined}
                        >
                          <Outlet />
                        </main>
                        {!hideChrome && <Footer />}
                        {!hideChrome && <BottomNav />}
                        {!hideChrome && <StickyCheckoutBar />}
                        {/* V2 persistent bottom navigation dock — fixed overlay,
                            shown only on primary browse/dashboard routes. */}
                        {showDock && <BottomDock />}
                        <CartDrawer />
                      </div>
                      <Toaster theme="dark" position="top-center" richColors offset={72} />
                    </PreferencesProvider>
                  </OrdersProvider>
                </CartProvider>
              </TooltipProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </ThemeProvider>
  );
}
