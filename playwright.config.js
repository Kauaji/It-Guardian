import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://127.0.0.1:4100/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: "memory",
        ENABLE_DEMO_SEED: "true",
        JWT_SECRET: "e2e-only-secret-with-at-least-32-characters",
        CLIENT_ORIGIN: "http://127.0.0.1:5174",
        ENABLE_REMOTE_ASSISTANCE: "true",
        REMOTE_ASSISTANCE_ENV: "lab",
        ENABLE_REMOTE_CAPTURE: "true",
        ENABLE_REMOTE_CONTROL: "true",
        REMOTE_ASSISTANCE_LAB_AUTO_CONSENT: "false",
        ENABLE_REMOTE_PRIVACY_MODE: "false",
        ENABLE_REMOTE_ADMIN_ACTIONS: "false",
        PORT: "4100"
      }
    },
    {
      command: "npm exec --workspace client vite -- --host 0.0.0.0 --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_API_URL: "http://127.0.0.1:4100",
        VITE_ENABLE_WS: "false",
        VITE_ENABLE_REMOTE_ASSISTANCE: "true",
        VITE_ENABLE_REMOTE_CONTROL: "true",
        VITE_ENABLE_REMOTE_PRIVACY_MODE: "false",
        VITE_ENABLE_REMOTE_ADMIN_ACTIONS: "false"
      }
    }
  ]
});
