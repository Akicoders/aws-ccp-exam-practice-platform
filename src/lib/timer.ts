/**
 * Timer model: start on first answer, visibility pause, 5/2/1 warnings,
 * auto-submit at zero, finite 2x wall-clock cap from first answer.
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
