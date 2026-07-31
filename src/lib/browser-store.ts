import {
  type BrowserStore,
  type AnswerRecord,
  type AnswerResult,
  type Domain,
  type SessionState,
  type SessionResult,
  type SessionConfig,
  type SessionPreset,
  type SessionStatus,
  type SessionMode,
  type IntegrityIncident,
  type IntegrityIncidentType,
  type DomainAnalytics,
  type Locale,
  type Theme,
  DOMAIN,
  LOCALE,
  OPTION_LETTER,
  SESSION_CONFIG,
  SESSION_MODE,
  INTEGRITY_INCIDENT_TYPE,
  SESSION_STATUS,
  STORAGE_KEY,
  THEME,
} from "@/types/contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function readOptionalNonNegativeInteger(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  return isNonNegativeInteger(value) ? value : null;
}

function isOptionLetter(value: unknown): value is (typeof OPTION_LETTER)[keyof typeof OPTION_LETTER] {
  return (
    typeof value === "string" &&
    Object.values(OPTION_LETTER).includes(
      value as (typeof OPTION_LETTER)[keyof typeof OPTION_LETTER]
    )
  );
}

function isDomain(value: unknown): value is Domain {
  return typeof value === "string" && Object.values(DOMAIN).includes(value as Domain);
}

function isLocale(value: unknown): value is Locale {
  return value === LOCALE.EN || value === LOCALE.ES;
}

function isTheme(value: unknown): value is Theme {
  return value === THEME.LIGHT || value === THEME.DARK;
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return Object.values(SESSION_STATUS).includes(value as SessionStatus);
}

function isSessionPreset(value: unknown): value is SessionPreset {
  return typeof value === "string" && Object.keys(SESSION_CONFIG).includes(value);
}

function isSessionMode(value: unknown): value is SessionMode {
  return value === SESSION_MODE.STUDY || value === SESSION_MODE.SIMULATION;
}

function isIntegrityIncidentType(value: unknown): value is IntegrityIncidentType {
  return Object.values(INTEGRITY_INCIDENT_TYPE).includes(value as IntegrityIncidentType);
}

function normalizeOptionLetters(value: unknown): (typeof OPTION_LETTER)[keyof typeof OPTION_LETTER][] | null {
  if (!Array.isArray(value)) return null;

  const letters: (typeof OPTION_LETTER)[keyof typeof OPTION_LETTER][] = [];
  for (const item of value) {
    if (!isOptionLetter(item)) return null;
    letters.push(item);
  }
  return letters;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const strings: string[] = [];
  for (const item of value) {
    if (!isNonEmptyString(item)) return null;
    strings.push(item);
  }
  return strings;
}

function normalizeRecords<T>(value: unknown, normalize: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];

  const records: T[] = [];
  for (const item of value) {
    const normalized = normalize(item);
    if (normalized) records.push(normalized);
  }
  return records;
}

function normalizeRequiredRecords<T>(
  value: unknown,
  normalize: (item: unknown) => T | null
): T[] | null {
  if (!Array.isArray(value)) return null;

  const records: T[] = [];
  for (const item of value) {
    const normalized = normalize(item);
    if (!normalized) return null;
    records.push(normalized);
  }
  return records;
}

function normalizeAnswerRecord(value: unknown): AnswerRecord | null {
  if (!isRecord(value) || !isNonEmptyString(value.questionId)) return null;
  const selected = normalizeOptionLetters(value.selected);
  if (!selected) return null;

  return { questionId: value.questionId, selected };
}

function normalizeAnswerResult(value: unknown): AnswerResult | null {
  if (!isRecord(value) || !isNonEmptyString(value.questionId) || typeof value.isCorrect !== "boolean") {
    return null;
  }
  const selected = normalizeOptionLetters(value.selected);
  const correctAnswers = normalizeOptionLetters(value.correctAnswers);
  if (!selected || !correctAnswers) return null;

  return {
    questionId: value.questionId,
    selected,
    correctAnswers,
    isCorrect: value.isCorrect,
  };
}

function normalizeIntegrityIncident(value: unknown): IntegrityIncident | null {
  if (!isRecord(value) || !isIntegrityIncidentType(value.type) || !isFiniteNumber(value.timestamp)) {
    return null;
  }

  return { type: value.type, timestamp: value.timestamp };
}

function normalizeSessionConfig(value: unknown): SessionConfig | null {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.questionCount) ||
    value.questionCount === 0 ||
    !isNonNegativeInteger(value.durationMinutes) ||
    value.durationMinutes === 0 ||
    !isNonEmptyString(value.label)
  ) {
    return null;
  }

  return {
    questionCount: value.questionCount,
    durationMinutes: value.durationMinutes,
    label: value.label,
  };
}

function normalizeSession(value: unknown): SessionState | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isSessionStatus(value.status)) {
    return null;
  }

  const questionIds = normalizeStringArray(value.questionIds);
  const answers = normalizeRequiredRecords(value.answers, normalizeAnswerRecord);
  const config = normalizeSessionConfig(value.config);
  if (
    !questionIds ||
    !answers ||
    !config ||
    !isNonNegativeInteger(value.currentIndex)
  ) {
    return null;
  }

  let startTime: number | null;
  if (value.startTime === null) {
    startTime = null;
  } else if (isFiniteNumber(value.startTime)) {
    startTime = value.startTime;
  } else {
    return null;
  }

  const elapsedVisibleMs = readOptionalNonNegativeInteger(value.elapsedVisibleMs, 0);
  if (elapsedVisibleMs === null) return null;

  let mode: SessionMode;
  if (value.mode === undefined) {
    mode = SESSION_MODE.STUDY;
  } else if (isSessionMode(value.mode)) {
    mode = value.mode;
  } else {
    return null;
  }

  const integrityIncidents = value.integrityIncidents === undefined
    ? []
    : normalizeRequiredRecords(value.integrityIncidents, normalizeIntegrityIncident);
  if (!integrityIncidents) return null;

  let visibleSince: number | null;
  if (value.visibleSince === undefined || value.visibleSince === null) {
    visibleSince = null;
  } else if (isFiniteNumber(value.visibleSince)) {
    visibleSince = value.visibleSince;
  } else {
    return null;
  }

  return {
    id: value.id,
    questionIds,
    answers,
    currentIndex: value.currentIndex,
    config,
    mode,
    startTime,
    elapsedVisibleMs,
    visibleSince: startTime === null ? null : visibleSince,
    integrityIncidents,
    status: value.status,
  };
}

function normalizeResult(value: unknown): SessionResult | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.sessionId) ||
    !isNonNegativeInteger(value.rawPoints) ||
    !isNonNegativeInteger(value.correctCount) ||
    !isNonNegativeInteger(value.totalQuestions) ||
    value.totalQuestions === 0 ||
    !isFiniteNumber(value.percentage) ||
    value.percentage < 0 ||
    value.percentage > 100 ||
    typeof value.passed !== "boolean" ||
    !isFiniteNumber(value.completedAt) ||
    !isSessionPreset(value.preset)
  ) {
    return null;
  }

  const answers = normalizeRequiredRecords(value.answers, normalizeAnswerResult);
  const timeSpentMs = readOptionalNonNegativeInteger(value.timeSpentMs, 0);
  const integrityIncidentCount = readOptionalNonNegativeInteger(value.integrityIncidentCount, 0);
  const mode = value.mode === undefined
    ? SESSION_MODE.STUDY
    : isSessionMode(value.mode)
      ? value.mode
      : null;
  if (
    !answers ||
    timeSpentMs === null ||
    integrityIncidentCount === null ||
    mode === null ||
    value.correctCount > value.totalQuestions ||
    value.rawPoints > value.totalQuestions
  ) {
    return null;
  }

  return {
    sessionId: value.sessionId,
    rawPoints: value.rawPoints,
    correctCount: value.correctCount,
    totalQuestions: value.totalQuestions,
    percentage: value.percentage,
    passed: value.passed,
    answers,
    timeSpentMs,
    completedAt: value.completedAt,
    preset: value.preset,
    mode,
    integrityIncidentCount,
  };
}

function normalizeAnalytics(value: unknown): DomainAnalytics | null {
  if (
    !isRecord(value) ||
    !isDomain(value.domain) ||
    !isNonNegativeInteger(value.correct) ||
    !isNonNegativeInteger(value.total) ||
    value.correct > value.total ||
    !isFiniteNumber(value.timestamp)
  ) {
    return null;
  }

  return {
    domain: value.domain,
    correct: value.correct,
    total: value.total,
    timestamp: value.timestamp,
  };
}

function getDefaultStore(locale: Locale, theme: Theme): BrowserStore {
  return {
    activeSessionId: null,
    sessions: [],
    results: [],
    analytics: [],
    locale,
    theme,
  };
}

export function loadStore(locale: Locale, theme: Theme): BrowserStore {
  try {
    if (typeof localStorage === "undefined") return getDefaultStore(locale, theme);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultStore(locale, theme);
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return getDefaultStore(locale, theme);

    const sessions = normalizeRecords(parsed.sessions, normalizeSession);
    const activeSessionId = isNonEmptyString(parsed.activeSessionId)
      ? parsed.activeSessionId
      : null;
    return {
      activeSessionId: activeSessionId && sessions.some((session) => session.id === activeSessionId)
        ? activeSessionId
        : null,
      sessions,
      results: normalizeRecords(parsed.results, normalizeResult),
      analytics: normalizeRecords(parsed.analytics, normalizeAnalytics),
      locale: isLocale(parsed.locale) ? parsed.locale : locale,
      theme: isTheme(parsed.theme) ? parsed.theme : theme,
    };
  } catch {
    return getDefaultStore(locale, theme);
  }
}

export function saveStore(store: BrowserStore): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable — silently handle
  }
}

export function getActiveSession(store: BrowserStore): SessionState | null {
  if (!store.activeSessionId) return null;
  return store.sessions.find((s) => s.id === store.activeSessionId) ?? null;
}

export function upsertSession(store: BrowserStore, session: SessionState): BrowserStore {
  const idx = store.sessions.findIndex((s) => s.id === session.id);
  const sessions = [...store.sessions];
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  return {
    ...store,
    activeSessionId: session.status === "active" || session.status === "paused"
      ? session.id
      : store.activeSessionId,
    sessions,
  };
}

export function addResult(store: BrowserStore, result: SessionResult): BrowserStore {
  const results = [...store.results, result];
  const analytics = mergeAnalytics(store.analytics, result);
  return {
    ...store,
    activeSessionId: null,
    sessions: store.sessions.map((s) =>
      s.id === result.sessionId ? { ...s, status: "completed" as const } : s
    ),
    results,
    analytics,
  };
}

function mergeAnalytics(
  existing: DomainAnalytics[],
  result: SessionResult
): DomainAnalytics[] {
  const map = new Map<string, DomainAnalytics>();
  for (const a of existing) {
    map.set(a.domain, a);
  }
  // Domain analytics are merged via mergeDomainAnalytics after scoring
  return existing;
}

export function mergeDomainAnalytics(
  existing: DomainAnalytics[],
  incoming: DomainAnalytics[]
): DomainAnalytics[] {
  const map = new Map<string, DomainAnalytics>();
  for (const a of existing) map.set(a.domain, a);
  for (const a of incoming) {
    const prev = map.get(a.domain);
    if (prev) {
      map.set(a.domain, {
        domain: a.domain,
        correct: prev.correct + a.correct,
        total: prev.total + a.total,
        timestamp: a.timestamp,
      });
    } else {
      map.set(a.domain, a);
    }
  }
  return Array.from(map.values());
}
