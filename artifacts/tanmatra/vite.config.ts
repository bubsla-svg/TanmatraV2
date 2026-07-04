import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";


export default defineConfig({
  base: basePath,
  plugins: [reactRouter(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Ensure only third-party vendor code in node_modules is chunked,
          // preventing circular dependencies between application chunks and vendor chunks.
          if (!id.includes("node_modules")) return;

          // Visualisation, charts, and mapping
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("leaflet")) return "maps";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("socket.io")) return "socket";

          // Heavy UI primitive frameworks & carousels
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("embla-carousel")) return "carousel";

          // Icon libraries split by vendor so routes only fetch needed icons
          if (id.includes("lucide-react")) return "icons-lucide";
          if (id.includes("@phosphor-icons")) return "icons-phosphor";
          if (id.includes("react-icons")) return "icons-react";
        },
      },
    },
  },
  // react-router build manages outDir internally (build/client, build/server).
  // Do not set build.outDir here — it conflicts with the reactRouter() plugin.
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
