import { test, expect } from "@playwright/test";

test.describe("Session page", () => {
  test("displays disclaimer on start page", async ({ page }) => {
    await page.goto("/en/");
    await expect(
      page.getByText(/does NOT represent official AWS exam results/)
    ).toBeVisible();
  });
});

test.describe("Resources page", () => {
  test("shows resource categories", async ({ page }) => {
    await page.goto("/en/resources/");
    await expect(page.getByText("Official AWS Resources")).toBeVisible();
    await expect(page.getByRole("heading", { name: "AWS Documentation", exact: true })).toBeVisible();
  });
});
