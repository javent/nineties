import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5174, strictPort: true, allowedHosts: true },
  preview: { host: "0.0.0.0", port: 5174, allowedHosts: true },
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
});
