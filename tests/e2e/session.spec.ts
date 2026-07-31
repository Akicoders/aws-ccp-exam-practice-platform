import { test, expect } from "@playwright/test";

test.describe("Session page", () => {
  test("displays disclaimer on start page", async ({ page }) => {
    await page.goto("/en/");
    await expect(
      page.getByText(/does NOT represent official AWS exam results/)
    ).toBeVisible();
  });

  test("counts down after the first answer and auto-advances single-select questions", async ({ page }) => {
    await page.goto("/en/session/?preset=short");
    const timer = page.getByRole("timer", { name: "Time remaining" });
    await expect(timer).toBeVisible();
    const initialTimer = await timer.textContent();
    let firstQuestion = "";
    let foundSingleSelect = false;

    for (let index = 0; index < 10; index++) {
      const radio = page.locator('input[type="radio"]').first();
      if (await radio.count()) {
        firstQuestion = (await page.locator("legend").first().textContent()) ?? "";
        await radio.check();
        foundSingleSelect = true;
        break;
      }

      await page.locator('input[type="checkbox"]').first().check();
      if (index < 9) await page.getByRole("button", { name: "Next", exact: true }).click();
    }

    expect(foundSingleSelect).toBe(true);
    await expect(page.locator("legend").first()).not.toHaveText(firstQuestion ?? "", { timeout: 2000 });
    await expect(timer).not.toHaveText(initialTimer ?? "", { timeout: 2500 });
  });

  test("keeps the active session, mode, answer, current question, and query when switching locale", async ({ page }) => {
    await page.goto("/en/session/?preset=short&mode=simulation");
    await expect(page.locator("legend").first()).toBeVisible();
    await page.locator('input[type="radio"], input[type="checkbox"]').first().check();
    await page.waitForTimeout(450);

    const before = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("aws-ccp-exam:v1") || "{}");
      const session = store.sessions.find((candidate: { id: string }) => candidate.id === store.activeSessionId);
      return {
        activeSessionId: store.activeSessionId,
        currentIndex: session?.currentIndex,
        answers: session?.answers,
        startTime: session?.startTime,
        mode: session?.mode,
      };
    });
    const localeSwitch = page.getByRole("link", { name: "Switch language", exact: true });

    await Promise.all([
      page.waitForURL(/\/es\/session\/\?preset=short&sessionId=/),
      localeSwitch.click(),
    ]);

    await expect(page.getByRole("timer", { name: "Tiempo restante" })).toBeVisible();
    const after = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("aws-ccp-exam:v1") || "{}");
      const session = store.sessions.find((candidate: { id: string }) => candidate.id === store.activeSessionId);
      return {
        activeSessionId: store.activeSessionId,
        currentIndex: session?.currentIndex,
        answers: session?.answers,
        startTime: session?.startTime,
        mode: session?.mode,
      };
    });

    expect(after.activeSessionId).toBe(before.activeSessionId);
    expect(after.currentIndex).toBe(before.currentIndex);
    expect(after.answers).toEqual(before.answers);
    expect(after.startTime).toBe(before.startTime);
    expect(before.mode).toBe("simulation");
    expect(after.mode).toBe(before.mode);
  });

  test("study mode allows focus changes without recording incidents", async ({ page }) => {
    await page.goto("/en/session/?preset=short&mode=study");
    await page.locator('input[type="radio"], input[type="checkbox"]').first().check();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });

    const session = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("aws-ccp-exam:v1") || "{}");
      return store.sessions.find((candidate: { id: string }) => candidate.id === store.activeSessionId);
    });

    expect(session.mode).toBe("study");
    expect(session.integrityIncidents).toEqual([]);
    await expect(page.getByRole("alert").filter({ hasText: /recorded/i })).toHaveCount(0);
  });

  test("simulation records focus loss, warns on return, and shows the result count", async ({ page }) => {
    await page.goto("/en/session/?preset=short&mode=simulation");
    await page.locator('input[type="radio"], input[type="checkbox"]').first().check();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    await expect(page.getByRole("alert").filter({ hasText: /tab visibility or focus change was recorded/i })).toBeVisible();

    await page.getByRole("button", { name: "Submit Exam", exact: true }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/results\/\?sessionId=/);
    await expect(page.getByText("Integrity incidents", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Integrity incidents", { exact: true }).locator("..").getByText("1", { exact: true })
    ).toBeVisible();
  });

  test("keeps multi-select questions deliberate until Next is pressed", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("aws-ccp-exam:v1", JSON.stringify({
        activeSessionId: "multi-select-regression",
        sessions: [{
          id: "multi-select-regression",
          questionIds: ["3891", "3641"],
          answers: [],
          currentIndex: 0,
          config: { questionCount: 10, durationMinutes: 10, label: "10 questions / 10 min" },
          startTime: null,
          elapsedVisibleMs: 0,
          visibleSince: null,
          status: "active",
        }],
        results: [],
        analytics: [],
        locale: "en",
        theme: "light",
      }));
    });
    await page.goto("/en/session/?preset=short&sessionId=multi-select-regression");
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(5);
    const questionBefore = (await page.locator("legend").first().textContent()) ?? "";
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await expect(checkboxes.nth(0)).toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
    await page.waitForTimeout(450);
    await expect(page.locator("legend").first()).toHaveText(questionBefore);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("legend").first()).not.toHaveText(questionBefore);
  });

  test("exposes quiz-only copy deterrence hooks without blocking controls", async ({ page }) => {
    await page.goto("/en/session/?preset=short");
    const quiz = page.locator('[data-copy-deterrence="client-side"]');
    await expect(quiz).toBeVisible();

    const copyPrevented = await quiz.evaluate((element) => {
      const event = new Event("copy", { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(copyPrevented).toBe(true);
    await page.locator('input[type="radio"], input[type="checkbox"]').first().check();
  });

  test("fits the quiz navigation and touch controls at 320px without horizontal overflow", async ({ page }) => {
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/en/session/?preset=short&viewport=${width}`);
      await expect(page.locator("legend").first()).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

      const questionButton = page.getByRole("button", { name: "Question 1", exact: true });
      const box = await questionButton.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("renders every answer in the expandable results review", async ({ page }) => {
    await page.goto("/en/session/?preset=short");
    await expect(page.locator("legend").first()).toBeVisible();

    for (let index = 0; index < 10; index++) {
      const radio = page.locator('input[type="radio"]').first();
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await radio.count()) {
        await radio.check();
        if (index < 9) await page.waitForTimeout(400);
      } else {
        await checkbox.check();
        if (index < 9) await page.getByRole("button", { name: "Next", exact: true }).click();
      }
    }

    await page.getByRole("button", { name: "Submit Exam", exact: true }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/results\/\?sessionId=/);
    await expect(page.locator("details")).toHaveCount(10);
    await expect(page.getByRole("heading", { name: "Complete Answer Review" })).toBeVisible();
    await expect(page.getByText("Time spent", { exact: true })).toBeVisible();
    await expect(page.getByText("Domain Breakdown", { exact: true })).toBeVisible();
    await expect(page.getByText("Next step", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 800 });
    const resultsDimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(resultsDimensions.documentWidth).toBeLessThanOrEqual(resultsDimensions.viewportWidth);
  });
});

test.describe("Resources page", () => {
  test("shows resource categories", async ({ page }) => {
    await page.goto("/en/resources/");
    await expect(page.getByText("Official AWS Resources")).toBeVisible();
    await expect(page.getByRole("heading", { name: "AWS Documentation", exact: true })).toBeVisible();
  });
});
