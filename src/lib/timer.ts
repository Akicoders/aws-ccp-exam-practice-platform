import { SESSION_MODE, type SessionState } from "@/types/contracts";

/**
 * Timer model: start on first answer, mode-specific hidden-tab behavior,
 * 5/2/1 warnings, auto-submit at zero, and a finite study wall-clock cap.
 */

export interface TimerState {
  /** Total session duration in ms */
  totalMs: number;
  /** When the first answer was given (timestamp) */
  firstAnswerAt: number | null;
  /** Accumulated ms spent visible before the current visible period */
  accruedVisibleMs: number;
  /** Timestamp when the tab became visible last */
  visibleSince: number | null;
  /** Whether the tab is currently hidden */
  hidden: boolean;
  /** Whether the timer has expired */
  expired: boolean;
  /** Whether warnings have been issued */
  warned5: boolean;
  warned2: boolean;
  warned1: boolean;
}

export interface TimerWarnings {
  warned5: boolean;
  warned2: boolean;
  warned1: boolean;
}

export function createTimer(durationMinutes: number): TimerState {
  return {
    totalMs: durationMinutes * 60 * 1000,
    firstAnswerAt: null,
    accruedVisibleMs: 0,
    visibleSince: null,
    hidden: false,
    expired: false,
    warned5: false,
    warned2: false,
    warned1: false,
  };
}

export function startTimer(state: TimerState, now: number): TimerState {
  if (state.firstAnswerAt !== null) return state;
  return { ...state, firstAnswerAt: now, visibleSince: now };
}

export function getVisibleElapsed(state: TimerState, now: number): number {
  if (state.firstAnswerAt === null) return 0;
  let elapsed = state.accruedVisibleMs;
  if (!state.hidden && state.visibleSince !== null) {
    elapsed += now - state.visibleSince;
  }
  return elapsed;
}

export function getWallClockElapsed(state: TimerState, now: number): number {
  if (state.firstAnswerAt === null) return 0;
  return now - state.firstAnswerAt;
}

export function getRemainingMs(state: TimerState, now: number): number {
  if (state.firstAnswerAt === null) return state.totalMs;
  const visible = getVisibleElapsed(state, now);
  return Math.max(0, state.totalMs - visible);
}

export function get2xCapMs(state: TimerState, now: number): number {
  if (state.firstAnswerAt === null) return state.totalMs;
  const cap = state.totalMs * 2;
  const wallClock = getWallClockElapsed(state, now);
  return Math.max(0, cap - wallClock);
}

export function shouldExpire(state: TimerState, now: number): boolean {
  if (state.firstAnswerAt === null) return false;
  // Zero remaining visible time
  if (getRemainingMs(state, now) <= 0) return true;
  // 2x wall-clock cap
  if (get2xCapMs(state, now) <= 0) return true;
  return false;
}

export function checkWarnings(
  state: TimerState,
  now: number
): { warned5: boolean; warned2: boolean; warned1: boolean } {
  const remaining = getRemainingMs(state, now);
  const w5 = remaining <= 5 * 60 * 1000;
  const w2 = remaining <= 2 * 60 * 1000;
  const w1 = remaining <= 1 * 60 * 1000;
  return {
    warned5: w5,
    warned2: w2,
    warned1: w1,
  };
}

export function onVisibilityChange(
  state: TimerState,
  hidden: boolean,
  now: number
): TimerState {
  if (state.firstAnswerAt === null) return state;
  if (hidden && !state.hidden) {
    // Tab hidden — pause displayed countdown
    const add = now - (state.visibleSince ?? now);
    return {
      ...state,
      hidden: true,
      accruedVisibleMs: state.accruedVisibleMs + add,
      visibleSince: null,
    };
  } else if (!hidden && state.hidden) {
    // Tab visible again
    return {
      ...state,
      hidden: false,
      visibleSince: now,
    };
  }
  return state;
}

/** Start the persisted session timer exactly once, on the first answer. */
export function startSessionTimer(session: SessionState, now: number): SessionState {
  if (session.startTime !== null) return session;
  return {
    ...session,
    startTime: now,
    visibleSince: now,
  };
}

/** Pause study time when hidden; simulation time always follows the wall clock. */
export function updateSessionVisibility(
  session: SessionState,
  hidden: boolean,
  now: number
): SessionState {
  if (session.startTime === null) return session;
  if (session.mode === SESSION_MODE.SIMULATION) return session;

  if (hidden && session.visibleSince !== null) {
    return {
      ...session,
      elapsedVisibleMs: session.elapsedVisibleMs + Math.max(0, now - session.visibleSince),
      visibleSince: null,
    };
  }

  if (!hidden && session.visibleSince === null) {
    return { ...session, visibleSince: now };
  }

  return session;
}

export function getSessionVisibleElapsedMs(session: SessionState, now: number): number {
  if (session.startTime === null) return 0;
  const currentVisibleMs = session.visibleSince === null
    ? 0
    : Math.max(0, now - session.visibleSince);
  return session.elapsedVisibleMs + currentVisibleMs;
}

export function getSessionElapsedMs(session: SessionState, now: number): number {
  if (session.startTime === null) return 0;
  if (session.mode === SESSION_MODE.SIMULATION) {
    return Math.max(0, now - session.startTime);
  }
  return getSessionVisibleElapsedMs(session, now);
}

export function getSessionRemainingMs(session: SessionState, now: number): number {
  if (session.startTime === null) return session.config.durationMinutes * 60 * 1000;
  return Math.max(0, session.config.durationMinutes * 60 * 1000 - getSessionElapsedMs(session, now));
}

export function getSessionWarnings(session: SessionState, now: number): TimerWarnings {
  const remaining = getSessionRemainingMs(session, now);
  return {
    warned5: remaining <= 5 * 60 * 1000,
    warned2: remaining <= 2 * 60 * 1000,
    warned1: remaining <= 1 * 60 * 1000,
  };
}

export function shouldExpireSession(session: SessionState, now: number): boolean {
  if (session.startTime === null) return false;
  if (getSessionRemainingMs(session, now) <= 0) return true;
  if (session.mode === SESSION_MODE.SIMULATION) return false;
  return now - session.startTime >= session.config.durationMinutes * 60 * 1000 * 2;
}
