import { describe, it, expect } from "vitest";
import {
  createTimer,
  startTimer,
  getRemainingMs,
  getWallClockElapsed,
  onVisibilityChange,
  shouldExpire,
  getSessionRemainingMs,
  getSessionWarnings,
  shouldExpireSession,
  startSessionTimer,
  updateSessionVisibility,
  getSessionElapsedMs,
} from "@/lib/timer";
import { SESSION_CONFIG, SESSION_MODE, SESSION_STATUS } from "@/types/contracts";
import type { SessionState } from "@/types/contracts";

function createSession(): SessionState {
  return {
    id: "s1",
    questionIds: ["q1"],
    answers: [],
    currentIndex: 0,
    config: SESSION_CONFIG.SHORT,
    mode: SESSION_MODE.STUDY,
    startTime: null,
    elapsedVisibleMs: 0,
    visibleSince: null,
    integrityIncidents: [],
    status: SESSION_STATUS.ACTIVE,
  };
}

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

describe("persisted session timer", () => {
  it("counts visible time down and preserves the start timestamp", () => {
    const started = startSessionTimer(createSession(), 1000);

    expect(getSessionRemainingMs(started, 2000)).toBe(599000);
    expect(startSessionTimer(started, 5000)).toBe(started);
  });

  it("pauses visible time while hidden and resumes from the same elapsed value", () => {
    const started = startSessionTimer(createSession(), 1000);
    const hidden = updateSessionVisibility(started, true, 11000);
    const resumed = updateSessionVisibility(hidden, false, 21000);

    expect(hidden.elapsedVisibleMs).toBe(10000);
    expect(getSessionRemainingMs(hidden, 21000)).toBe(590000);
    expect(getSessionRemainingMs(resumed, 22000)).toBe(589000);
  });

  it("keeps simulation time running while hidden", () => {
    const started = startSessionTimer(
      { ...createSession(), mode: SESSION_MODE.SIMULATION },
      1000
    );
    const hidden = updateSessionVisibility(started, true, 11000);

    expect(hidden).toBe(started);
    expect(getSessionElapsedMs(hidden, 21000)).toBe(20000);
    expect(getSessionRemainingMs(hidden, 21000)).toBe(580000);
    expect(shouldExpireSession(hidden, 601001)).toBe(true);
  });

  it("exposes warning thresholds and the wall-clock cap", () => {
    const started = startSessionTimer(createSession(), 0);

    expect(getSessionWarnings(started, 300001)).toEqual({
      warned5: true,
      warned2: false,
      warned1: false,
    });
    expect(shouldExpireSession(started, 1200001)).toBe(true);
  });
});
