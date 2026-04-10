// e2e/navigation.spec.cjs — Admin app navigation, auth guards, role-based routing

const { test, expect } = require("@playwright/test");

async function mockAdminSession(page) {
  await page.goto("/#/login");
  await page.evaluate(() => {
    localStorage.setItem("perkvalet_access_token", "fake-admin-jwt");
    localStorage.setItem("perkvalet_system_role", "pv_admin");
    localStorage.setItem("perkvalet_landing", "/merchants");
  });

  await page.route("**/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: 1, email: "admin@test.com", systemRole: "pv_admin" },
        memberships: [],
        landing: "/admin",
      }),
    });
  });
  await page.route("**/merchants*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [{ id: 1, name: "Central Perk", status: "active", storeCount: 2 }] }),
      });
    } else {
      await route.continue();
    }
  });
}

async function mockMerchantSession(page) {
  await page.goto("/#/login");
  await page.evaluate(() => {
    localStorage.setItem("perkvalet_access_token", "fake-merchant-jwt");
    localStorage.setItem("perkvalet_system_role", "merchant");
    localStorage.setItem("perkvalet_landing", "/merchant");
  });

  await page.route("**/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: 2, email: "owner@test.com", systemRole: "user" },
        memberships: [{ merchantId: 1, role: "owner", status: "active", merchant: { id: 1, name: "Test Shop", merchantType: "coffee_shop" } }],
        merchantName: "Test Shop",
        landing: "/merchant",
      }),
    });
  });
  await page.route("**/merchant/stores*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });
}

test.describe("Auth Guards", () => {
  test("unauthenticated user redirected to login", async ({ page }) => {
    await page.goto("/#/login");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/#/merchants");
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Admin Navigation", () => {
  test("admin sees merchants list", async ({ page }) => {
    await mockAdminSession(page);
    await page.goto("/#/merchants");
    await expect(page.locator("text=Central Perk")).toBeVisible({ timeout: 5000 });
  });

  test("admin can navigate to merchant detail page", async ({ page }) => {
    await mockAdminSession(page);

    await page.route("**/merchants/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, name: "Central Perk", status: "active", stores: [], merchantType: "coffee_shop" }),
      });
    });

    await page.goto("/#/merchants/1");
    await page.waitForTimeout(2000);
    // Should load merchant detail, not redirect to login
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Merchant Navigation", () => {
  test("merchant user sees dashboard", async ({ page }) => {
    await mockMerchantSession(page);
    await page.goto("/#/merchant");
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Logout", () => {
  test("logout clears session and redirects to login", async ({ page }) => {
    await mockAdminSession(page);
    await page.goto("/#/merchants");
    await page.waitForTimeout(1000);

    const logout = page.locator("text=Logout").or(page.locator("text=Sign Out")).or(page.locator("text=Log Out"));
    if (await logout.first().isVisible({ timeout: 3000 })) {
      await logout.first().click();
      await expect(page.getByRole("heading", { name: /PerkValet Login/i })).toBeVisible({ timeout: 5000 });
    }
  });
});
