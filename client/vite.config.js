import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@dnd-kit")) return "vendor-dnd";
          if (id.includes("lucide-react")) return "vendor-icons";
          return "vendor";
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
