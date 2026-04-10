// playwright.config.cjs — PerkValet Admin App E2E tests
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.cjs",
  timeout: 30000,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:5176",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5176",
    port: 5176,
    timeout: 15000,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
