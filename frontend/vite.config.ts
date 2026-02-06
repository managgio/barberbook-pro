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
          if (!id.includes("node_modules")) return;
          if (id.includes("firebase")) return "vendor-firebase";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("@radix-ui") || id.includes("@floating-ui") || id.includes("cmdk") || id.includes("sonner")) {
            return "vendor-ui";
          }
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("react-dom") || id.includes("scheduler")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },
}));
