// Builds Muffins' Tracker 2.0 as a library for Mudora 2.0 (see entry.ts).
// Copied into his checkout next to his vite.config.ts by mfns-build.yml:
//   bunx vite build --config vite.lib.config.ts
import path from "path";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

function version(): string {
  try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return "unknown"; }
}

export default defineConfig({
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(version()), "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    outDir: "dist-lib",
    emptyOutDir: true,
    lib: { entry: path.resolve(__dirname, "./src/mfns-lib-entry.ts"), formats: ["es"], fileName: () => "mfns.js" },
    minify: false,
    sourcemap: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
