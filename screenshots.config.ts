import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testMatch: "tests/screenshots/screenshots.ts",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: `POSTGRES_URL="******localhost:5432/db" node_modules/.bin/next dev --port 3000`,
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
