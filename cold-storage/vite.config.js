import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: "0.0.0.0", allowedHosts: true },
  // One small Three.js application bundle; the offline exporter inlines it as well.
  build: { target: "es2022", chunkSizeWarningLimit: 1000 },
});
