// e2e/payment-events.spec.cjs — Admin payment event audit view

const { test, expect } = require("@playwright/test");

async function mockAdminAuth(page) {
  await page.goto("/#/login");
  await page.evaluate(() => {
    localStorage.setItem("perkvalet_access_token", "fake-admin-jwt");
    localStorage.setItem("perkvalet_system_role", "pv_admin");
    localStorage.setItem("perkvalet_landing", "/admin");
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

  await page.route("**/admin/payment-events*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { id: 1, eventType: "payment_completed", source: "square", amountCents: 1250, merchantId: 1, storeId: 1, phone: null, providerEventId: "sq_pay_001", transactionId: null, upc: null, createdAt: "2026-04-10T12:00:00Z" },
          { id: 2, eventType: "subsidy_applied", source: "grocery", amountCents: 250, merchantId: 1, storeId: 1, phone: "4085551234", providerEventId: null, transactionId: "txn-abc123", upc: "012345678901", createdAt: "2026-04-10T12:05:00Z" },
          { id: 3, eventType: "payment_completed", source: "stripe", amountCents: 5000, merchantId: 1, storeId: null, phone: null, providerEventId: "pi_test_001", transactionId: null, upc: null, createdAt: "2026-04-10T12:10:00Z" },
        ],
      }),
    });
  });

  await page.route("**/admin/settlement-report*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ totalSubsidyCents: 250, eventCount: 1, byMerchant: [{ merchantId: 1, totalCents: 250 }], byPromotion: [] }),
    });
  });
}

test.describe("Payment Event Audit View", () => {
  test("shows audit ledger page", async ({ page }) => {
    await mockAdminAuth(page);
    await page.goto("/#/admin/payment-events");
    await expect(page.locator("text=Payment Event Audit Ledger")).toBeVisible({ timeout: 5000 });
  });

  test("shows event table rows", async ({ page }) => {
    await mockAdminAuth(page);
    await page.goto("/#/admin/payment-events");
    // Should show the provider IDs in the table
    await expect(page.locator("text=sq_pay_001")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=pi_test_001")).toBeVisible();
  });

  test("shows source filter dropdown", async ({ page }) => {
    await mockAdminAuth(page);
    await page.goto("/#/admin/payment-events");
    const select = page.locator("select").first();
    await expect(select).toBeVisible({ timeout: 5000 });
  });

  test("shows export CSV button", async ({ page }) => {
    await mockAdminAuth(page);
    await page.goto("/#/admin/payment-events");
    await expect(page.locator("text=Export CSV")).toBeVisible({ timeout: 5000 });
  });

  test("shows subsidy total", async ({ page }) => {
    await mockAdminAuth(page);
    await page.goto("/#/admin/payment-events");
    await expect(page.locator("text=Total Subsidies")).toBeVisible({ timeout: 5000 });
  });
});
