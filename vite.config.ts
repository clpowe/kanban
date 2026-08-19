import { defineConfig } from "vite";
import solidPlugin from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [solidPlugin()],
  publicDir: false,
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8787",
      "/session": "http://localhost:8787",
    },
  },
  build: {
    target: "esnext",
    outDir: "public",
    emptyOutDir: true,
  },
});
