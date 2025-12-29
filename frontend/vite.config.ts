import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import crypto from "crypto";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    imageKitSignPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

const imageKitSignPlugin = () => ({
  name: "imagekit-sign-endpoint",
  configureServer(server) {
    server.middlewares.use("/api/imagekit/sign", (req, res) => {
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.end("Method not allowed");
        return;
      }

      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
      const publicKey =
        process.env.VITE_IMAGEKIT_PUBLIC_KEY || process.env.IMAGEKIT_PUBLIC_KEY;
      const urlEndpoint =
        process.env.VITE_IMAGEKIT_URL_ENDPOINT ||
        process.env.IMAGEKIT_URL_ENDPOINT;

      if (!privateKey || !publicKey || !urlEndpoint) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error:
              "ImageKit no está configurado. Revisa las variables de entorno.",
          })
        );
        return;
      }

      const token = crypto.randomBytes(16).toString("hex");
      const expire = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutos
      const signature = crypto
        .createHmac("sha1", privateKey)
        .update(token + expire)
        .digest("hex");

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          token,
          expire,
          signature,
          publicKey,
          urlEndpoint,
        })
      );
    });
  },
});
