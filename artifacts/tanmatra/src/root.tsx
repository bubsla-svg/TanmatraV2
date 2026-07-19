import { useEffect, type ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useMatches, useLocation } from "react-router";
import type { LinksFunction, MetaFunction } from "react-router";
import { API_BASE } from "@/lib/apiBase";
import { Toaster } from "sonner";
import NetworkStatusToast from "./components/NetworkStatusToast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider, useCart } from "@/lib/cartContext";
import { ThemeManager } from "@/lib/clinicalTheme";
import { ThemeProvider } from "next-themes";
import { OrdersProvider } from "@/lib/ordersContext";
import { PreferencesProvider } from "@/lib/preferencesContext";
import OnboardingQuizGate from "@/components/preferences/OnboardingQuizGate";
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
import interFontUrl from "@fontsource-variable/inter/files/inter-latin-standard-normal.woff2?url";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://images.unsplash.com" },
  // Phosphor icon weights for the v2 screens (loaded asynchronously to avoid render blocking).
  { rel: "stylesheet", href: "/phosphor/regular/style.css", media: "print", id: "ph-regular-css" },
  { rel: "stylesheet", href: "/phosphor/fill/style.css", media: "print", id: "ph-fill-css" },
  { rel: "stylesheet", href: "/phosphor/bold/style.css", media: "print", id: "ph-bold-css" },
  // Critical font — Inter Variable latin subset is the first face the browser
  // needs. Without this hint it discovers the URL only after CSS is parsed.
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    href: interFontUrl,
    crossOrigin: "anonymous",
  },
  // PWA manifest — enables "Add to Home Screen" prompt on Android Chrome.
  { rel: "manifest", href: "/manifest.webmanifest" },
];

export const meta: MetaFunction = () => [
  { title: "Tanmatra — Therapeutic Meal Delivery" },
  { name: "description", content: "Clinical-grade therapeutic meals designed by registered dietitians. Browse the curated menu, build personalised weekly plans, and track wellness, performance, and clinical protocols." },
  { name: "theme-color", content: "#" + "0B0C0E" },
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
    background: var(--bg);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 20px;
  }
  #__tanmatra-loader.hidden { display: none; }
  .__tl-wordmark { color: var(--color-nn-primary); font-size: 1.25rem; font-weight: 600; letter-spacing: 0.08em; font-family: serif; }
  .__tl-sub { color: var(--text-secondary); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.12em; }
  .__tl-bar { width: 120px; height: 2px; background: var(--border); border-radius: 2px; overflow: hidden; }
  .__tl-bar-inner { height: 100%; width: 0%; background: var(--color-nn-primary); animation: __tl-slide 1.4s ease-in-out infinite; }
  @keyframes __tl-slide { 0%{width:0%;margin-left:0} 50%{width:60%;margin-left:20%} 100%{width:0%;margin-left:100%} }
  .__tl-retry { display: none; margin-top: 8px; background: transparent; border: 1px solid var(--color-nn-primary); color: var(--color-nn-primary);
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
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
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
                "addressLocality": "Noida",
                "addressRegion": "Uttar Pradesh",
                "addressCountry": "IN"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "email": "care@tanmatra.health",
                "telephone": "+919289213115"
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
          <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--color-stone-0)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"12px", fontFamily:"sans-serif", textAlign:"center", padding:"24px" }}>
            <strong style={{ color:"var(--color-nn-primary)", fontSize:"1.25rem" }}>Tanmatra</strong>
            <p style={{ color:"var(--text-secondary)", fontSize:"0.875rem", maxWidth:"320px" }}>
              Dietitian-designed meals, delivered fresh
              across Noida. This app needs JavaScript — or reach
              us directly:
            </p>
            <p style={{ fontSize:"0.875rem" }}>
              <a href="mailto:care@tanmatra.health" style={{ color:"var(--color-nn-primary)" }}>care@tanmatra.health</a>
            </p>
            <p style={{ color:"var(--text-secondary)", fontSize:"0.8125rem", maxWidth:"320px" }}>
              <a href="/menu" style={{ color:"var(--color-nn-primary)" }}>Menu</a>
              {" · "}
              <a href="/plans" style={{ color:"var(--color-nn-primary)" }}>Meal plans</a>
              {" · "}
              <a href="/faq" style={{ color:"var(--color-nn-primary)" }}>FAQ</a>
              {" · "}
              <a href="/refunds" style={{ color:"var(--color-nn-primary)" }}>Refunds</a>
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

const STICKY_CHECKOUT_HIDE = [
  /^\/cart\/?$/,
  /^\/checkout(\/.*)?$/,
  /^\/track(\/.*)?$/,
  /^\/admin(\/.*)?$/,
  /^\/rd-console(\/.*)?$/,
  /^\/subscribe(\/.*)?$/,
  /^\/subscriptions(\/.*)?$/,
  /^\/subscription-plans(\/.*)?$/,
  /^\/plans(\/.*)?$/,
  /^\/dish\/.+/,
  /^\/marketplace\/.+/,
];

function AppShellInner() {
  const matches = useMatches();
  const hideChrome = matches.some((m) => (m.handle as { chrome?: boolean } | null)?.chrome === false);
  const currentPath = useLocation().pathname;
  const { items } = useCart();

  const dockHidden = ["/checkout", "/cart", "/track", "/login", "/admin"].some(
    (deny) => currentPath === deny || currentPath.startsWith(deny + "/"),
  );
  const dockShown = ["/menu", "/wellness", "/subscriptions", "/orders", "/account", "/recipes", "/challenges"].some(
    (root) => currentPath === root || currentPath.startsWith(root + "/"),
  );
  const showDock = !dockHidden && (currentPath === "/" || dockShown);
  const showCheckoutBar = items.length > 0 && !STICKY_CHECKOUT_HIDE.some((re) => re.test(currentPath));

  const paddingBottomStyle = showDock && showCheckoutBar
    ? "calc(138px + var(--safe-bottom, 0px))"
    : showDock
    ? "calc(60px + var(--safe-bottom, 0px))"
    : showCheckoutBar
    ? "calc(78px + var(--safe-bottom, 0px))"
    : undefined;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        hideChrome ? "text-foreground" : "bg-background text-foreground"
      }`}
      style={hideChrome ? { background: "var(--bg)" } : undefined}
    >
      {!hideChrome && <Header />}
      {!hideChrome && <WelcomeOfferBanner />}
      {!hideChrome && <OnboardingQuizGate />}
      <main
        className={hideChrome ? "flex-1" : "flex-1 pb-20 md:pb-0"}
        style={paddingBottomStyle ? { paddingBottom: paddingBottomStyle } : undefined}
      >
        <Outlet />
      </main>
      {!hideChrome && <Footer />}
      {!hideChrome && <BottomNav />}
      {!hideChrome && <StickyCheckoutBar />}
      {showDock && <BottomDock />}
      <CartDrawer />
    </div>
  );
}

export default function Root() {
  useEffect(() => {
    window.__clearTanmatraLoader?.();
    // Enable phosphor styles after hydration
    ["ph-regular-css", "ph-fill-css", "ph-bold-css"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("media", "all");
    });
  }, []);

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
                  <AppShellInner />
                  <Toaster theme="dark" position="top-center" richColors offset={72} />
                  <NetworkStatusToast />
                </PreferencesProvider>
              </OrdersProvider>
            </CartProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
