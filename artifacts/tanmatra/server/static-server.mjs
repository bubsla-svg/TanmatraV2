/**
 * Production server for the Tanmatra SPA.
 *
 * Two jobs:
 *  1. Serve the prerendered static build (real per-route index.html when it
 *     exists, the route-agnostic __spa-fallback.html otherwise — never the
 *     home page's HTML, which would hydrate the wrong route context).
 *  2. Reverse-proxy /api/* (HTTP + WebSocket upgrade) to API_UPSTREAM so the
 *     browser only ever talks to ONE origin. This makes the session cookie
 *     first-party — Safari/ITP and Chrome Incognito silently drop the
 *     cross-site cookie the old topology (tanmatra.food → run.app) relied
 *     on, which broke login the moment the OTP verified.
 *
 * Zero dependencies: node core only.
 */
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const SPA = path.join(ROOT, "__spa-fallback.html");
const PORT = Number(process.env.PORT || 8080);

// e.g. https://wellness-foods-475157072474.asia-south2.run.app
// (origin only — the /api prefix on the request path is forwarded as-is,
// since the API mounts its routes under /api).
const API_UPSTREAM = (process.env.API_UPSTREAM || "").replace(/\/+$/, "");
const upstream = API_UPSTREAM ? new URL(API_UPSTREAM) : null;
const upstreamTls = upstream?.protocol === "https:";
const upstreamPort = upstream ? Number(upstream.port || (upstreamTls ? 443 : 80)) : 0;

const TYPES = {
  html: "text/html",
  js: "application/javascript",
  css: "text/css",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  ico: "image/x-icon",
  webmanifest: "application/manifest+json",
  xml: "application/xml",
  txt: "text/plain",
  woff2: "font/woff2",
  woff: "font/woff",
};

// Text asset types worth compressing. Binary/pre-compressed types (images,
// woff2) are skipped — re-compressing them wastes CPU for ~no gain.
const COMPRESSIBLE = new Set(["html", "js", "css", "json", "svg", "xml", "txt", "webmanifest"]);

// Security headers for the document + asset context the SPA actually executes
// in (Helmet on the API only protects JSON responses; the browsing context is
// served here). The CSP is intentionally minimal — `frame-ancestors 'none'`
// gives clickjacking protection without risking a broken hydration from a
// too-strict resource policy on an existing SPA.
// Third-party origins the live checkout/auth paths require:
//   • Razorpay Checkout — checkout.js (script), the payment modal iframe
//     (api/checkout.razorpay.com), telemetry (lumberjack), instrument logos
//     (cdn). Without these the payment modal cannot load or render.
//   • Firebase phone-OTP — RecaptchaVerifier loads reCAPTCHA from
//     google.com/gstatic.com and renders its challenge in a google.com
//     frame; the SDK talks to identitytoolkit/securetoken over connect-src.
//   • Google Places (New) REST — the picker's direct autocomplete/details
//     (the server /geo/search fallback covers the blocked case, but allowing
//     it restores the faster first-party path).
//   • *.tile.openstreetmap.org — Leaflet map tiles (picker map + RiderMap),
//     loaded as <img>, so governed by img-src.
const CSP_POLICY_RULES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://images.unsplash.com https://lh3.googleusercontent.com https://checkout.razorpay.com https://www.google.com https://www.gstatic.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://lh3.googleusercontent.com https://tanmatra.food https://*.tile.openstreetmap.org https://cdn.razorpay.com",
  "connect-src 'self' https://api.petpooja.com https://api.razorpay.com https://lumberjack.razorpay.com https://places.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.google.com",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "report-uri /api/v1/csp-report",
].join("; ");

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // geolocation=(self): the checkout address picker calls
  // navigator.geolocation on this document. With geolocation=() the browser
  // denies instantly and never shows the permission prompt — allow it on our
  // own origin. payment=(self): Razorpay's checkout uses the Payment Request
  // API. camera/microphone stay denied — nothing here uses them.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=(self)",
  "Content-Security-Policy": CSP_POLICY_RULES,
  "Content-Security-Policy-Report-Only": CSP_POLICY_RULES,
};

function pickEncoding(req, ext) {
  if (!COMPRESSIBLE.has(ext)) return null;
  const ae = String(req.headers["accept-encoding"] || "");
  if (/\bbr\b/.test(ae)) return "br";
  if (/\bgzip\b/.test(ae)) return "gzip";
  return null;
}

function serveStatic(req, res) {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let f = path.join(ROOT, u === "/" ? "/index.html" : u);
  // Path traversal guard — resolved file must stay inside ROOT.
  if (!path.resolve(f).startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    const i = path.join(f, "index.html");
    f = fs.existsSync(i) ? i : SPA;
  } else if (!fs.existsSync(f)) {
    f = SPA;
  }
  const ext = path.extname(f).slice(1);
  // The service worker must never be cached immutably (updates would freeze
  // forever) and WebKit requires an explicit script content-type + scope
  // header to pass its access-control checks.
  const isSw = u === "/sw.js";
  const encoding = pickEncoding(req, ext);
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Cache-Control":
      ext === "html" || isSw ? "no-cache" : "public,max-age=31536000,immutable",
    Vary: "Accept-Encoding",
    ...SECURITY_HEADERS,
    ...(isSw ? { "Service-Worker-Allowed": "/" } : {}),
    ...(encoding ? { "Content-Encoding": encoding } : {}),
  });
  const source = fs.createReadStream(f);
  source.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  if (encoding === "br") {
    source.pipe(zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })).pipe(res);
  } else if (encoding === "gzip") {
    source.pipe(zlib.createGzip({ level: 6 })).pipe(res);
  } else {
    source.pipe(res);
  }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (typeof fwd === "string" && fwd.split(",")[0].trim()) || req.socket.remoteAddress || "";
}

function proxyHttp(req, res) {
  const headers = { ...req.headers };
  headers.host = upstream.host;
  // Preserve the real client for the API's rate limiting / logging.
  headers["x-forwarded-for"] = clientIp(req);
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-host"] = req.headers.host || "";

  const opts = {
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstreamPort,
    path: req.url,
    method: req.method,
    headers,
  };
  const client = (upstreamTls ? https : http).request(opts, (up) => {
    // Pass status + headers straight through — including Set-Cookie, which
    // the browser now stores first-party against THIS origin.
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  client.on("error", (err) => {
    console.error("api proxy error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "upstream unavailable" }));
  });
  req.pipe(client);
}

const server = http.createServer((req, res) => {
  if (req.url === "/api/build") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...SECURITY_HEADERS,
    });
    res.end(
      JSON.stringify({
        sha: process.env.BUILD_SHA || "unknown",
        builtAt: process.env.BUILT_AT || new Date().toISOString(),
        service: "tanmatra",
      })
    );
    return;
  }
  if (upstream && req.url.startsWith("/api")) {
    proxyHttp(req, res);
    return;
  }
  serveStatic(req, res);
});

// WebSocket upgrade pass-through for /api/socket.io — hand-rolled splice:
// open a raw (TLS) socket to the upstream, replay the handshake, then pipe
// both directions. socket.io falls back to HTTP long-polling (which the
// plain proxy above already handles) if this ever fails.
server.on("upgrade", (req, socket, head) => {
  if (!upstream || !req.url.startsWith("/api")) {
    socket.destroy();
    return;
  }
  const connect = () =>
    upstreamTls
      ? tls.connect({ host: upstream.hostname, port: upstreamPort, servername: upstream.hostname })
      : net.connect({ host: upstream.hostname, port: upstreamPort });
  const upSocket = connect();
  upSocket.on("error", (err) => {
    console.error("ws proxy error:", err.message);
    socket.destroy();
  });
  socket.on("error", () => upSocket.destroy());
  upSocket.on(upstreamTls ? "secureConnect" : "connect", () => {
    const lines = [
      `${req.method} ${req.url} HTTP/1.1`,
      `host: ${upstream.host}`,
      `x-forwarded-for: ${clientIp(req)}`,
      `x-forwarded-proto: https`,
    ];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k === "host" || k === "x-forwarded-for" || k === "x-forwarded-proto") continue;
      const vals = Array.isArray(v) ? v : [v];
      for (const val of vals) lines.push(`${k}: ${val}`);
    }
    upSocket.write(lines.join("\r\n") + "\r\n\r\n");
    if (head && head.length > 0) upSocket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
});

server.listen(PORT, () => {
  console.log(
    `Serving on ${PORT}${upstream ? ` (proxying /api → ${API_UPSTREAM})` : " (no API_UPSTREAM — static only)"}`,
  );
});
