import { test, expect } from "@playwright/test";

test.describe("Static routes", () => {
  test("root page displays locale chooser", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "English" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Español" })).toBeVisible();
  });

  test("shared navigation exposes an accessible GitHub link", async ({ page }) => {
    await page.goto("/en/");
    const githubLink = page.getByRole("link", {
      name: "View project on GitHub",
      exact: true,
    });

    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/Akicoders/aws-ccp-exam-practice-platform",
    );
    await expect(githubLink).toHaveAttribute("title", "View project on GitHub");
    await githubLink.focus();
    await expect(githubLink).toBeFocused();
  });

  test("/en loads the English home page", async ({ page }) => {
    await page.goto("/en/");
    await expect(page.getByText("Select a Practice Mode")).toBeVisible();
  });

  test("/es loads the Spanish home page", async ({ page }) => {
    await page.goto("/es/");
    await expect(page.getByText("Selecciona un Modo de Práctica")).toBeVisible();
  });

  test("starts the selected simulation mode with a preset", async ({ page }) => {
    await page.goto("/en/");
    await page.getByRole("radio", { name: /Simulation mode/ }).check();
    await page.getByRole("button", { name: /10 questions \/ 10 min/ }).click();
    await expect(page).toHaveURL(/\/en\/session\/\?preset=short&mode=simulation/);
  });

  test("starts a custom exam and preserves its config across locale switching", async ({ page }) => {
    await page.goto("/en/");
    const customExam = page.getByRole("region", { name: "Custom exam" });

    await customExam.getByLabel("Duration (minutes)").fill("12");
    await customExam.getByLabel("Total questions").fill("10");
    await customExam.getByLabel("Cloud Concepts").fill("10");
    await customExam.getByLabel("Security and Compliance").fill("20");
    await customExam.getByLabel("Cloud Technology and Services").fill("30");
    await customExam.getByLabel("Billing, Pricing, and Support").fill("40");
    await customExam.getByLabel("Exam mode").selectOption("simulation");

    await expect(customExam).toContainText("1 question");
    await expect(customExam).toContainText("2 questions");
    await expect(customExam).toContainText("3 questions");
    await expect(customExam).toContainText("4 questions");

    await customExam.getByRole("button", { name: "Start custom exam", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/session\/\?preset=custom&sessionId=/);
    await expect(page.getByRole("heading", { name: "Custom exam", exact: true })).toBeVisible();

    const before = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("aws-ccp-exam:v1") || "{}");
      const session = store.sessions.find((candidate: { id: string }) => candidate.id === store.activeSessionId);
      return { config: session?.config, mode: session?.mode };
    });
    expect(before.config).toMatchObject({
      questionCount: 10,
      durationMinutes: 12,
      isCustom: true,
      domainWeights: {
        CLOUD_CONCEPTS: 10,
        SECURITY: 20,
        TECHNOLOGY_SERVICES: 30,
        BILLING_PRICING: 40,
      },
    });
    expect(before.mode).toBe("simulation");

    await Promise.all([
      page.waitForURL(/\/es\/session\/\?preset=custom&sessionId=/),
      page.getByRole("link", { name: "Switch language", exact: true }).click(),
    ]);
    await expect(page.getByRole("heading", { name: "Examen personalizado", exact: true })).toBeVisible();

    const after = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("aws-ccp-exam:v1") || "{}");
      const session = store.sessions.find((candidate: { id: string }) => candidate.id === store.activeSessionId);
      return session?.config;
    });
    expect(after).toEqual(before.config);

    await page.getByRole("button", { name: "Enviar Examen", exact: true }).click();
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page).toHaveURL(/\/es\/results\/\?sessionId=/);
    await expect(page.getByText("Examen personalizado", { exact: true })).toBeVisible();
    await expect(page.getByText(/Distribución solicitada:/).first()).toBeVisible();
    await expect(page.getByText(/Preguntas reales:/).first()).toBeVisible();
  });

  test("localized resources pages hydrate through the shared layout", async ({ page }) => {
    for (const route of [
      [
        "/en/resources/?sessionId=preserve-me",
        "Study Resources",
        "View project on GitHub",
        "Switch language",
        "/es/resources/?sessionId=preserve-me",
      ],
      [
        "/es/resources/?sessionId=preserve-me",
        "Recursos de Estudio",
        "Ver el proyecto en GitHub",
        "Cambiar idioma",
        "/en/resources/?sessionId=preserve-me",
      ],
    ] as const) {
      const response = await page.goto(route[0], { waitUntil: "commit" });
      if (!response) throw new Error(`No response received for ${route[0]}`);
      const initialHtml = await response.text();
      expect(initialHtml).toContain('role="status"');
      expect(initialHtml).toContain('aria-busy="true"');
      await expect(page.getByRole("heading", { name: route[1] })).toBeVisible();
      const navigation = page.getByRole("navigation", { name: "Main navigation" });
      await expect(navigation).toBeVisible();
      await expect(page.getByRole("link", { name: route[2], exact: true })).toBeVisible();
      await expect(
        navigation.getByRole("link", { name: route[3], exact: true }),
      ).toHaveAttribute("href", route[4]);
      await expect(page.getByRole("contentinfo")).toBeVisible();
    }
  });

  test("session page auto-creates a session with timer and disclaimer", async ({ page }) => {
    await page.goto("/en/session/");
    await expect(page.getByRole("timer", { name: "Time remaining" })).toBeVisible();
    await expect(page.getByText(/does NOT represent official AWS exam results/)).toBeVisible();
  });

  test("session exposes an accessible loading state", async ({ page }) => {
    await page.goto("/es/session/?preset=short", { waitUntil: "commit" });
    const loading = page.getByRole("status");

    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(loading).toHaveAttribute("aria-label", "Cargando...");
    await expect(loading).toContainText("Cargando...");
  });

  test("Spanish session keeps English question text visible", async ({ page }) => {
    await page.goto("/es/session/?preset=short");
    const question = page.locator("legend").first();

    await expect(question).toBeVisible();
    await expect(question).toHaveAttribute("lang", "en");
    await expect(question).not.toHaveText("Selecciona una respuesta");
    await expect(question).not.toHaveText("Selecciona todas las que correspondan");
    await expect(page.getByText("Selecciona una respuesta").or(page.getByText("Selecciona todas las que correspondan"))).toBeVisible();
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
