import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Polyfill Node.js modules for simple-peer
      stream: "stream-browserify",
      buffer: "buffer",
      process: "process/browser",
      util: "util",
      events: "events",
    },
  },
  define: {
    global: "globalThis",
    "process.env": {},
    "process.browser": true,
    "process.version": JSON.stringify("v16.0.0"),
    "process.nextTick": "queueMicrotask",
  },
  optimizeDeps: {
    include: ["buffer", "process", "simple-peer", "stream-browserify", "util", "events"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
}));
