import { test, expect } from "@playwright/test";

test.describe("01. Landing Page & Navigation", () => {
  test("loads homepage with brand and club details", async ({ page }) => {
    await page.goto("/");
    // Check page title / club name
    await expect(page.locator("body")).toContainText("Rally Padel Club");
  });

  test("can navigate directly to /book and see courts", async ({ page }) => {
    await page.goto("/book");
    await expect(page).toHaveURL(/\/book/);
    // Court selection or booking details should be visible
    await expect(page.locator("body")).toContainText("Panoramic");
  });

  test("can navigate to /bookings", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/bookings/);
  });

  test("can navigate to /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    // Should display admin login or dashboard
    await expect(page.locator("body")).toBeVisible();
  });
});
