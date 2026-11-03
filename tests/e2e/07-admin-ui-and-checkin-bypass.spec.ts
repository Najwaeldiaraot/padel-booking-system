import { test, expect } from "@playwright/test";

test.describe("07. Admin UI, Zero Loop & Check-in Bypass Toggle", () => {
  test("switches admin tabs smoothly without infinite network request spam", async ({ page }) => {
    let blockRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/admin/blocks")) {
        blockRequests++;
      }
    });

    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    // Click tabs to verify smooth switching
    const tabs = ["Booking", "Jadwal", "Pelanggan", "Pengaturan", "Ringkasan"];
    for (const tabName of tabs) {
      const tabBtn = page.getByRole("button", { name: tabName, exact: false });
      if (await tabBtn.count()) {
        await tabBtn.first().click();
        await page.waitForTimeout(150);
      }
    }

    // Wait 1.5 seconds to ensure no runaway loop
    await page.waitForTimeout(1500);

    // If there were an infinite loop, blockRequests would be > 15-30. With fix it should be <= 3.
    expect(blockRequests).toBeLessThanOrEqual(4);
  });

  test("interacts with Testing Mode (Bypass Check-in) toggle switch", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    // Check if bypass toggle exists
    const toggle = page.getByRole("switch", { name: /mode testing/i });
    if (await toggle.count()) {
      const initialState = await toggle.getAttribute("aria-checked");
      await toggle.click();
      const newState = await toggle.getAttribute("aria-checked");
      expect(newState).not.toBe(initialState);

      // Return back to initial
      await toggle.click();
    }
  });

  test("checks notifications bell menu and mark all read action", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    const bellBtn = page.getByRole("button", { name: /notifikasi/i });
    if (await bellBtn.count()) {
      await bellBtn.first().click();

      // Ensure popover appears
      const popover = page.getByText(/Notifikasi klub/i);
      await expect(popover).toBeVisible();

      // Check if "Tandai semua dibaca" exists
      const markAllBtn = page.getByRole("button", { name: /tandai semua dibaca/i });
      if (await markAllBtn.count()) {
        await markAllBtn.click();
      }
    }
  });
});
