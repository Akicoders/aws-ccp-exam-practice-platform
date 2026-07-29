import { describe, it, expect } from "vitest";
import {
  createTimer,
  startTimer,
  getRemainingMs,
  getWallClockElapsed,
  onVisibilityChange,
  shouldExpire,
} from "@/lib/timer";

describe("createTimer", () => {
  it("creates timer with correct total duration", () => {
    const timer = createTimer(10);
    expect(timer.totalMs).toBe(600000);
    expect(timer.firstAnswerAt).toBeNull();
    expect(timer.expired).toBe(false);
  });
});

describe("startTimer", () => {
  it("starts on first answer and ignores subsequent calls", () => {
    const timer = createTimer(10);
    const started = startTimer(timer, 1000);
    expect(started.firstAnswerAt).toBe(1000);

    const again = startTimer(started, 2000);
    expect(again.firstAnswerAt).toBe(1000); // unchanged
  });
});

describe("getRemainingMs", () => {
  it("returns totalMs before timer starts", () => {
    const timer = createTimer(10);
    expect(getRemainingMs(timer, 0)).toBe(600000);
  });

  it("decreases as visible time passes", () => {
    const timer = createTimer(1); // 60s
    const started = startTimer(timer, 0);
    const elapsed = getRemainingMs(started, 30000); // 30s visible
    expect(elapsed).toBe(30000);
  });
});

describe("getWallClockElapsed", () => {
  it("returns 0 before start", () => {
    const timer = createTimer(10);
    expect(getWallClockElapsed(timer, 10000)).toBe(0);
  });

  it("increases with wall clock time", () => {
    const timer = createTimer(10);
    const started = startTimer(timer, 0);
    expect(getWallClockElapsed(started, 5000)).toBe(5000);
  });
});

describe("onVisibilityChange", () => {
  it("pauses visible time when hidden", () => {
    const timer = createTimer(10);
    const started = startTimer(timer, 0);
    // Visible for 10s, then hide
    const hidden = onVisibilityChange(started, true, 10000);
    expect(hidden.hidden).toBe(true);
    expect(hidden.accruedVisibleMs).toBe(10000);
    expect(hidden.visibleSince).toBeNull();
  });

  it("resumes on return", () => {
    const timer = createTimer(10);
    const started = startTimer(timer, 0);
    const hidden = onVisibilityChange(started, true, 5000);
    const visible = onVisibilityChange(hidden, false, 10000);
    expect(visible.hidden).toBe(false);
    expect(visible.visibleSince).toBe(10000);
  });
});

describe("shouldExpire", () => {
  it("does not expire before timer starts", () => {
    const timer = createTimer(10);
    expect(shouldExpire(timer, 1000)).toBe(false);
  });

  it("expires when visible time runs out", () => {
    const timer = createTimer(0.1); // 6s
    const started = startTimer(timer, 0);
    // Wait more than 6s visible
    expect(shouldExpire(started, 7000)).toBe(true);
  });

  it("2x wall-clock cap expires even with hidden time", () => {
    const timer = createTimer(1); // 60s
    const started = startTimer(timer, 0);
    // 2x cap at 120s wall clock
    expect(shouldExpire(started, 121000)).toBe(true);
  });
});
