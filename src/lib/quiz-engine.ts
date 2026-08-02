import {
  type NormalizedQuestion,
  type DomainPool,
  type QuestionData,
  type SessionPreset,
  type SessionState,
  type SessionResult,
  type AnswerRecord,
  type AnswerResult,
  type OptionLetter,
  type Domain,
  type DomainAnalytics,
  type IntegrityIncidentType,
  type SessionMode,
  type DomainWeights,
  type SessionSpec,
  DOMAIN,
  DEFAULT_DOMAIN_WEIGHTS,
  DOMAIN_ORDER,
  SESSION_CONFIG,
  SESSION_PRESET,
  SESSION_MODE,
  SESSION_STATUS,
} from "@/types/contracts";
import { getSessionElapsedMs } from "@/lib/timer";

export interface QuotaAssignment {
  domain: Domain;
  count: number;
}

export interface SamplingWarning {
  type: "low-pool" | "unmet-quota";
  message: string;
}

/** Compute deterministic largest-remainder quotas from whole-number weights. */
export function computeLargestRemainderQuotas(
  total: number,
  domainWeights: DomainWeights = DEFAULT_DOMAIN_WEIGHTS
): QuotaAssignment[] {
  if (!Number.isInteger(total) || total <= 0) {
    return DOMAIN_ORDER.map((domain) => ({ domain, count: 0 }));
  }

  const weighted = DOMAIN_ORDER.map((domain, order) => {
    const rawQuota = (domainWeights[domain] / 100) * total;
    const base = Math.floor(rawQuota);
    return {
      domain,
      count: base,
      remainder: rawQuota - base,
      order,
    };
  });

  let remaining = total - weighted.reduce((sum, quota) => sum + quota.count, 0);
  const ranked = [...weighted].sort(
    (left, right) => right.remainder - left.remainder || left.order - right.order
  );

  for (let index = 0; index < remaining; index += 1) {
    ranked[index % ranked.length].count += 1;
  }

  return weighted.map(({ domain, count }) => ({ domain, count }));
}

/** Compute quotas and report pool-capacity risks without changing requested counts. */
export function computeQuotas(
  total: number,
  poolSizes: Record<Domain, number>,
  domainWeights: DomainWeights = DEFAULT_DOMAIN_WEIGHTS
): { quotas: QuotaAssignment[]; warnings: SamplingWarning[] } {
  const warnings: SamplingWarning[] = [];

  const quotas = computeLargestRemainderQuotas(total, domainWeights);
  for (const quota of quotas) {
    const poolSize = Math.max(0, poolSizes[quota.domain] ?? 0);
    if (quota.count > 0 && quota.count > poolSize * 0.8) {
      warnings.push({
        type: "low-pool",
        message: `Some domains are running low on fresh questions.`,
      });
    }
    if (quota.count > poolSize) {
      warnings.push({
        type: "unmet-quota",
        message: `Not enough unique questions in ${quota.domain}. Try a shorter session.`,
      });
    }
  }

  return { quotas, warnings };
}

/**
 * Sample questions for a session ensuring no duplicate IDs within session.
 */
export function sampleSession(
  data: Pick<QuestionData, "pools">,
  selection: SessionPreset | SessionSpec
): {
  questions: NormalizedQuestion[];
  warnings: SamplingWarning[];
  spec: SessionSpec;
} {
  const config: SessionSpec = typeof selection === "string"
    ? SESSION_CONFIG[selection]
    : selection;
  const spec: SessionSpec = {
    ...config,
    domainWeights: config.domainWeights ?? DEFAULT_DOMAIN_WEIGHTS,
    isCustom: config.isCustom ?? false,
  };
  const poolSizes: Record<Domain, number> = {} as Record<Domain, number>;
  for (const pool of data.pools) {
    poolSizes[pool.domain] = pool.questions.length;
  }

  const { quotas, warnings: quotaWarnings } = computeQuotas(
    spec.questionCount,
    poolSizes,
    spec.domainWeights
  );
  const warnings = [...quotaWarnings];

  // Track used IDs across all pools for uniqueness within this session
  const usedIds = new Set<string>();
  const selected: NormalizedQuestion[] = [];

  for (const qa of quotas) {
    const pool = data.pools.find((p) => p.domain === qa.domain);
    if (!pool) continue;

    const candidates = pool.questions.filter((q) => !usedIds.has(q.id));
    const picked = pickRandomQuestions(candidates, qa.count);
    for (const q of picked) {
      usedIds.add(q.id);
      selected.push(q);
    }

    // Never reuse an ID inside a session, even when a domain is short.
    if (picked.length < qa.count) {
      warnings.push({
        type: "unmet-quota",
        message: `Not enough unique questions in ${qa.domain}. Try a shorter session.`,
      });
    }
  }

  // Shuffle only the small session result, not the full question bank.
  selected.sort(() => Math.random() - 0.5);

  return {
    questions: selected,
    warnings,
    spec,
  };
}

function pickRandomQuestions(
  questions: NormalizedQuestion[],
  count: number
): NormalizedQuestion[] {
  const picked: NormalizedQuestion[] = [];
  const candidates = [...questions];
  const limit = Math.min(count, candidates.length);

  for (let index = 0; index < limit; index++) {
    const randomIndex = index + Math.floor(Math.random() * (candidates.length - index));
    [candidates[index], candidates[randomIndex]] = [
      candidates[randomIndex],
      candidates[index],
    ];
    picked.push(candidates[index]);
  }

  return picked;
}

/**
 * Create a new session state.
 */
export function createSession(
  questions: NormalizedQuestion[],
  config: SessionSpec,
  mode: SessionMode = SESSION_MODE.STUDY
): SessionState {
  const isCustom = config.isCustom ?? false;
  const sessionConfig = {
    questionCount: config.questionCount,
    durationMinutes: config.durationMinutes,
    label: config.label ?? `${config.questionCount} questions / ${config.durationMinutes} min`,
    domainWeights: config.domainWeights ?? DEFAULT_DOMAIN_WEIGHTS,
    isCustom,
  };

  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    questionIds: questions.map((q) => q.id),
    answers: [],
    currentIndex: 0,
    config: sessionConfig,
    mode,
    startTime: null,
    elapsedVisibleMs: 0,
    visibleSince: null,
    integrityIncidents: [],
    status: SESSION_STATUS.ACTIVE,
  };
}

/**
 * Record an answer for a question.
 */
export function recordAnswer(
  session: SessionState,
  questionId: string,
  selected: OptionLetter[]
): SessionState {
  const existing = session.answers.findIndex((a) => a.questionId === questionId);
  let answers: AnswerRecord[];
  if (existing >= 0) {
    answers = session.answers.map((a, i) =>
      i === existing ? { ...a, selected } : a
    );
  } else {
    answers = [...session.answers, { questionId, selected }];
  }
  return { ...session, answers };
}

export function recordIntegrityIncident(
  session: SessionState,
  type: IntegrityIncidentType,
  timestamp: number
): SessionState {
  if (session.mode !== SESSION_MODE.SIMULATION) return session;
  return {
    ...session,
    integrityIncidents: [...session.integrityIncidents, { type, timestamp }],
  };
}

/**
 * Score a completed session.
 */
export function scoreSession(
  session: SessionState,
  questions: NormalizedQuestion[],
  completedAt = Date.now()
): { result: SessionResult; domainAnalytics: DomainAnalytics[] } {
  const correctAnswers: AnswerResult[] = [];
  const domainCounts: Record<string, { correct: number; total: number }> = {};

  for (const q of questions) {
    const answer = session.answers.find((a) => a.questionId === q.id);
    let isCorrect = false;

    if (answer && q.multiSelect) {
      // All-or-nothing multi-select
      const correct = [...q.correctAnswers].sort();
      const selected = [...answer.selected].sort();
      isCorrect =
        correct.length === selected.length &&
        correct.every((v, i) => v === selected[i]);
    } else if (answer && !q.multiSelect) {
      isCorrect =
        answer.selected.length === 1 &&
        answer.selected[0] === q.correctAnswers[0];
    }

    correctAnswers.push({
      questionId: q.id,
      selected: answer?.selected ?? [],
      correctAnswers: q.correctAnswers,
      isCorrect,
    });

    const domain = q.domain;
    if (!domainCounts[domain]) domainCounts[domain] = { correct: 0, total: 0 };
    domainCounts[domain].total += 1;
    if (isCorrect) domainCounts[domain].correct += 1;
  }

  const correctCount = correctAnswers.filter((a) => a.isCorrect).length;
  const totalQuestions = questions.length;
  const rawPoints = correctCount;
  const percentage = totalQuestions > 0 ? (rawPoints / totalQuestions) * 100 : 0;
  const passed = percentage >= 70;

  const domainAnalytics: DomainAnalytics[] = Object.entries(domainCounts).map(
    ([domain, counts]) => ({
      domain: domain as Domain,
      correct: counts.correct,
      total: counts.total,
      timestamp: Date.now(),
    })
  );

  const result: SessionResult = {
    sessionId: session.id,
    rawPoints,
    correctCount,
    totalQuestions,
    percentage,
    passed,
    answers: correctAnswers,
    timeSpentMs: getSessionElapsedMs(session, completedAt),
    completedAt,
    preset: session.config.isCustom
      ? SESSION_PRESET.CUSTOM
      : Object.entries(SESSION_CONFIG).find(
          ([, c]) => c.questionCount === totalQuestions && c.durationMinutes === session.config.durationMinutes
        )?.[0] as SessionPreset ?? SESSION_PRESET.SHORT,
    mode: session.mode,
    integrityIncidentCount: session.mode === SESSION_MODE.SIMULATION
      ? session.integrityIncidents.length
      : 0,
    config: session.config,
  };

  return { result, domainAnalytics };
}
