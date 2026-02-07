import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://127.0.0.1:3000",
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("/node_modules/")) return;
          if (normalizedId.includes("/firebase/")) return "vendor-firebase";
          if (normalizedId.includes("/recharts/") || normalizedId.includes("/d3-")) return "vendor-charts";
          if (normalizedId.includes("/date-fns/")) return "vendor-date";
          if (normalizedId.includes("/react-dom/") || normalizedId.includes("/react/") || normalizedId.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (
            normalizedId.includes("/react-router-dom/")
            || normalizedId.includes("/react-router/")
            || normalizedId.includes("/@remix-run/router/")
            || normalizedId.includes("/history/")
          ) {
            return "vendor-router";
          }
          if (normalizedId.includes("/@tanstack/")) return "vendor-query";
          if (normalizedId.includes("/@radix-ui/")) return "vendor-radix";
          if (normalizedId.includes("/lucide-react/")) return "vendor-icons";
          if (
            normalizedId.includes("/class-variance-authority/")
            || normalizedId.includes("/clsx/")
            || normalizedId.includes("/tailwind-merge/")
          ) {
            return "vendor-ui-utils";
          }
          return "vendor-misc";
        },
      },
    },
  },
}));
