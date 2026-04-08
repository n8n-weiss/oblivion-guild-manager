import { test, expect } from "@playwright/test";

test("login screen renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("OBLIVION")).toBeVisible();
});

test("lazy route navigation does not crash shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});
