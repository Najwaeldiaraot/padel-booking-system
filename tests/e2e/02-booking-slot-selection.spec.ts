import { test, expect } from "@playwright/test";

test.describe("02. Booking & Slot Selection", () => {
  test("selects future date, court, and an available time slot", async ({ page }) => {
    // Go to booking page
    await page.goto("/book");
    await expect(page).toHaveURL(/\/book/);

    // Pick a date in future to ensure slots are available
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const dateStr = futureDate.toISOString().slice(0, 10);

    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
    await dateInput.fill(dateStr);

    // Locate available slot buttons
    const availableSlots = page.locator('button[aria-label*="tersedia"]');
    await expect(availableSlots.first()).toBeVisible({ timeout: 10000 });

    // Click the first available slot
    const slotText = await availableSlots.first().innerText();
    await availableSlots.first().click();

    // Verify slot is selected (has aria-pressed="true")
    await expect(availableSlots.first()).toHaveAttribute("aria-pressed", "true");
  });
});
