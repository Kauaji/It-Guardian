import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/**/*.test.*", "src/test/**", "src/main.jsx"],
      reporter: ["text-summary", "json-summary"],
      // Catraca: so sobe. Medido em 2026-10 (1.701 testes): linhas 73,4 / ramos 83,3 / funcoes 69,5.
      thresholds: { lines: 72, statements: 72, branches: 82, functions: 68 }
    }
  }
});
