import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "three",
      "three/examples/jsm/controls/OrbitControls.js",
      "three/examples/jsm/environments/RoomEnvironment.js",
      "three/examples/jsm/geometries/RoundedBoxGeometry.js",
      "three/examples/jsm/loaders/GLTFLoader.js"
    ]
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("three")) return "vendor-three";
          if (id.includes("qrcode")) return "vendor-qrcode";
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
