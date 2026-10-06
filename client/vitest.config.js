import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
    // Fluxos longos de user-event ficam lentos sob cobertura/CPU compartilhada (CI de 2 vCPUs).
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/**/*.test.*", "src/test/**", "src/main.jsx"],
      reporter: ["text-summary", "json-summary"],
      // Catraca: so sobe. Medido em 2026-10 (2.419 testes): linhas 93,4 / ramos 89,2 / funcoes 85,4.
      thresholds: { lines: 92, statements: 92, branches: 88, functions: 84 }
    }
  }
});
