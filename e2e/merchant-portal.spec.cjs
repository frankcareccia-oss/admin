// e2e/merchant-portal.spec.cjs — Merchant portal pages (stores, products, promotions, users)

const { test, expect } = require("@playwright/test");

async function mockMerchantAuth(page) {
  await page.goto("/#/login");
  await page.evaluate(() => {
    localStorage.setItem("perkvalet_access_token", "fake-jwt");
    localStorage.setItem("perkvalet_system_role", "merchant");
    localStorage.setItem("perkvalet_landing", "/merchant");
  });

  await page.route("**/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: 2, email: "owner@test.com", systemRole: "user" },
        memberships: [{ merchantId: 1, role: "owner", status: "active", merchant: { id: 1, name: "Test Coffee", merchantType: "coffee_shop" } }],
        merchantName: "Test Coffee",
        landing: "/merchant",
      }),
    });
  });
  await page.route("**/merchant/stores*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ id: 1, name: "Downtown", status: "active", merchantId: 1 }] }),
    });
  });
  await page.route("**/merchant/products*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ id: 1, name: "Espresso", status: "active", sku: "ESP-001", merchantId: 1 }] }),
    });
  });
  await page.route("**/merchant/promotions*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ promotions: [{ id: 1, name: "Coffee Card", status: "active", mechanic: "stamps", threshold: 5, merchantId: 1 }] }),
    });
  });
  await page.route("**/merchant/users*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [{ merchantUserId: 1, userId: 2, email: "owner@test.com", role: "owner", status: "active" }] }),
    });
  });
  await page.route("**/merchant/invoices*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], nextCursor: null }),
    });
  });
  await page.route("**/merchant/bundles*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ bundles: [] }),
    });
  });
  await page.route("**/merchant/growth-advisor*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ summary: "Looking good!", metrics: { aov: 0, totalOrders: 0, repeatRate: 0 }, insights: [], recommendations: [] }),
    });
  });
  await page.route("**/merchant/reports/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ range: "30d", totalVisits: 0, identifiedVisits: 0, anonymousVisits: 0, uniqueConsumers: 0, totalRedemptions: 0, stores: [], promotions: [] }),
    });
  });
}

test.describe("Merchant Stores", () => {
  test("shows stores page", async ({ page }) => {
    await mockMerchantAuth(page);
    await page.goto("/#/merchant/stores");
    await page.waitForTimeout(2000);
    // Should load the stores page without crashing
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Merchant Products", () => {
  test("shows products page", async ({ page }) => {
    await mockMerchantAuth(page);
    await page.goto("/#/merchant/products");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Merchant Promotions", () => {
  test("shows promotions page", async ({ page }) => {
    await mockMerchantAuth(page);
    await page.goto("/#/merchant/promotions");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Merchant Users", () => {
  test("shows users page", async ({ page }) => {
    await mockMerchantAuth(page);
    await page.goto("/#/merchant/users");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Merchant Invoices", () => {
  test("shows invoices page", async ({ page }) => {
    await mockMerchantAuth(page);
    await page.goto("/#/merchant/invoices");
    await page.waitForTimeout(1000);
    // Should load without crashing — empty state is fine
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Merchant Growth Advisor", () => {
  test("shows growth advisor page", async ({ page }) => {
    await mockMerchantAuth(page);
    await page.goto("/#/merchant/growth-advisor");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Merchant Settings", () => {
  test("shows settings page", async ({ page }) => {
    await mockMerchantAuth(page);

    await page.route("**/pos/connect/square/status*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ connected: false }) });
    });

    await page.goto("/#/merchant/settings");
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
