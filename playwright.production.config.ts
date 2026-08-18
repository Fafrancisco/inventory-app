import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PROD_BASE_URL;
const protectionBypass = process.env.VERCEL_PROTECTION_BYPASS;

if (!baseURL) {
  throw new Error("PROD_BASE_URL is required, for example https://inventory.example.com");
}

export default defineConfig({
  testDir: "./tests/e2e/production",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    extraHTTPHeaders: protectionBypass
      ? { "x-vercel-protection-bypass": protectionBypass }
      : undefined,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});