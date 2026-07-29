import { test, expect } from "@playwright/test";

test.describe("Static routes", () => {
  test("root page displays locale chooser", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "English" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Español" })).toBeVisible();
  });

  test("/en loads the English home page", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.getByText("Select a Practice Mode")).toBeVisible();
  });

  test("/es loads the Spanish home page", async ({ page }) => {
    await page.goto("/es/");
    await expect(page.getByText("Selecciona un Modo de Práctica")).toBeVisible();
  });

  test("/en/resources loads resources page", async ({ page }) => {
    await page.goto("/en/resources/");
    await expect(page.getByText("Study Resources")).toBeVisible();
  });

  test("session page auto-creates a session with timer and disclaimer", async ({ page }) => {
    await page.goto("/en/session/");
    await expect(page.getByRole("timer", { name: "Time remaining" })).toBeVisible();
    await expect(page.getByText(/does NOT represent official AWS exam results/)).toBeVisible();
  });
});

test.describe("Locale switching", () => {
  test("can switch from EN to ES", async ({ page }) => {
    await page.goto("/en/");
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    const localeSwitch = navigation.getByRole("link", { name: "Switch language", exact: true });
    await expect(localeSwitch).toHaveText("ES");
    await Promise.all([
      page.waitForURL(/\/es\/$/),
      localeSwitch.click(),
    ]);
    await expect(page.getByText("Selecciona un Modo de Práctica")).toBeVisible();
  });

  test("can switch from ES to EN", async ({ page }) => {
    await page.goto("/es/");
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    const localeSwitch = navigation.getByRole("link", { name: "Cambiar idioma", exact: true });
    await expect(localeSwitch).toHaveText("EN");
    await Promise.all([
      page.waitForURL(/\/en\/$/),
      localeSwitch.click(),
    ]);
    await expect(page.getByText("Select a Practice Mode")).toBeVisible();
  });
});
