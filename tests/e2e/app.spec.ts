import { test, expect } from "@playwright/test";

test("shows the primary recommendation on the now screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Do this now")).toBeVisible();
});
