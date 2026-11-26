import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// base "./" keeps the bundle relocatable (Databricks Apps serves it behind a proxy path).
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ["recharts"],
          radix: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-switch",
          ],
        },
      },
    },
  },
});
