import { test, expect } from "@playwright/test";

test.describe("02. Booking & Slot Selection", () => {
  test("selects future date, court, and an available time slot", async ({ page }) => {
    // Pick a date in future to ensure slots are available
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const dateStr = futureDate.toISOString().slice(0, 10);

    // Go to booking page with pre-selected date and court
    await page.goto(`/book?date=${dateStr}&court=1`);
    await expect(page).toHaveURL(/\/book/);
    await page.waitForLoadState("domcontentloaded");

    // Locate available slot buttons
    const availableSlots = page.locator('button[aria-label*="tersedia"]');
    await expect(availableSlots.first()).toBeVisible({ timeout: 10000 });

    // Click the first available slot
    await availableSlots.first().click();

    // Verify slot is selected (has aria-pressed="true")
    await expect(availableSlots.first()).toHaveAttribute("aria-pressed", "true");

    // Verify continue button is active and displays correct action
    const continueBtn = page.getByRole("button", { name: /masuk & lanjutkan|lanjutkan ke pembayaran/i });
    await expect(continueBtn).toBeEnabled();
  });
});
