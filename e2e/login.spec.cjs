// e2e/login.spec.cjs — Admin app login flow

const { test, expect } = require("@playwright/test");

test.describe("Admin Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/login");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/#/login");
  });

  test("displays login page with branding", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /PerkValet/i })).toBeVisible({ timeout: 5000 });
  });

  test("shows email and password fields", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
  });

  test("shows Sign In button", async ({ page }) => {
    await expect(page.locator("button[type='submit']")).toBeVisible({ timeout: 5000 });
  });

  test("email field has default value", async ({ page }) => {
    const email = page.getByRole("textbox", { name: /email/i });
    await expect(email).toHaveValue("admin@perkvalet.local", { timeout: 5000 });
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.route("**/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }),
      });
    });

    await page.getByRole("textbox", { name: /email/i }).fill("bad@test.com");
    await page.getByRole("textbox", { name: /password/i }).fill("wrongpass");
    await page.locator("button[type='submit']").click();

    // Error should appear
    await page.waitForTimeout(2000);
    const hasError = await page.locator("text=Invalid").or(page.locator("[style*='error']")).or(page.locator("[style*='#fca5a5']")).first().isVisible();
    expect(hasError).toBeTruthy();
  });

  test("successful admin login navigates away from login", async ({ page }) => {
    await page.route("**/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "fake-admin-jwt", systemRole: "pv_admin", landing: "/admin" }),
      });
    });
    await page.route("**/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: 1, email: "admin@test.com", systemRole: "pv_admin" }, memberships: [], landing: "/admin" }),
      });
    });
    await page.route("**/merchants*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    });

    await page.getByRole("textbox", { name: /email/i }).fill("admin@test.com");
    await page.getByRole("textbox", { name: /password/i }).fill("ValidPass!");
    await page.locator("button[type='submit']").click();

    // Should navigate away from login
    await expect(page.getByRole("heading", { name: /PerkValet Login/i })).not.toBeVisible({ timeout: 10000 });
  });

  test("forgot password link exists", async ({ page }) => {
    await expect(page.locator("text=Forgot").or(page.locator("a[href*='forgot']")).first()).toBeVisible({ timeout: 5000 });
  });

  test("POS login link exists", async ({ page }) => {
    await expect(page.locator("text=POS Login")).toBeVisible({ timeout: 5000 });
  });
});
