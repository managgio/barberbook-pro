import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "node:fs";
import { componentTagger } from "lovable-tagger";

const resolveBackendProxyTarget = () => {
  if (process.env.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }
  const runtimePortFile = path.resolve(__dirname, "../backend/.dev-port");
  if (fs.existsSync(runtimePortFile)) {
    const runtimePort = fs.readFileSync(runtimePortFile, "utf8").trim();
    if (/^\d+$/.test(runtimePort)) {
      return `http://localhost:${runtimePort}`;
    }
  }
  return "http://localhost:3000";
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: resolveBackendProxyTarget(),
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
          if (normalizedId.includes("/@tanstack/")) return "vendor-query";
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
