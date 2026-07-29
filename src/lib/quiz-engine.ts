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
  DOMAIN,
  DOMAIN_TARGETS,
  DOMAIN_ORDER,
  SESSION_CONFIG,
  SESSION_STATUS,
} from "@/types/contracts";

export interface SessionSpec {
  questionCount: number;
  durationMinutes: number;
}

export interface QuotaAssignment {
  domain: Domain;
  count: number;
}

export interface SamplingWarning {
  type: "low-pool" | "unmet-quota";
  message: string;
}

/**
 * Compute largest-remainder quotas from domain targets.
 */
export function computeQuotas(
  total: number,
  poolSizes: Record<Domain, number>
): { quotas: QuotaAssignment[]; warnings: SamplingWarning[] } {
  const domains = DOMAIN_ORDER;
  const warnings: SamplingWarning[] = [];

  // Initial proportional allocation
  const raw = domains.map((d) => ({
    domain: d,
    quota: DOMAIN_TARGETS[d] * total,
    poolSize: poolSizes[d],
  }));

  // Largest remainder method
  let allocated = 0;
  const quotas = raw.map((r) => {
    const base = Math.floor(r.quota);
    allocated += base;
    return { domain: r.domain, count: base, remainder: r.quota - base };
  });

  let remaining = total - allocated;
  quotas.sort((a, b) => b.remainder - a.remainder);

  for (const q of quotas) {
    if (remaining <= 0) break;
    const needed = q.count + 1;
    if (needed > poolSizes[q.domain] * 0.8) {
      warnings.push({
        type: "low-pool",
        message: `Some domains are running low on fresh questions.`,
      });
    }
    if (needed > poolSizes[q.domain]) {
      warnings.push({
        type: "unmet-quota",
        message: `Not enough unique questions in ${q.domain}. Try a shorter session.`,
      });
      // Still assign what we can
      q.count += Math.min(remaining, poolSizes[q.domain] - q.count);
      remaining -= Math.min(remaining, poolSizes[q.domain] - q.count);
    } else {
      q.count += 1;
      remaining -= 1;
    }
  }

  return {
    quotas: quotas.map(({ domain, count }) => ({ domain, count })),
    warnings,
  };
}

/**
 * Sample questions for a session ensuring no duplicate IDs within session.
 */
export function sampleSession(
  data: QuestionData,
  preset: SessionPreset,
  previousSessionIds: string[]
): {
  questions: NormalizedQuestion[];
  warnings: SamplingWarning[];
  spec: SessionSpec;
} {
  const config = SESSION_CONFIG[preset];
  const poolSizes: Record<Domain, number> = {} as Record<Domain, number>;
  for (const pool of data.pools) {
    poolSizes[pool.domain] = pool.questions.length;
  }

  const { quotas, warnings } = computeQuotas(config.questionCount, poolSizes);

  // Track used IDs across all pools for uniqueness within this session
  const usedIds = new Set<string>();
  const selected: NormalizedQuestion[] = [];

  for (const qa of quotas) {
    const pool = data.pools.find((p) => p.domain === qa.domain);
    if (!pool) continue;

    const candidates = pool.questions.filter((q) => !usedIds.has(q.id));
    // Shuffle and pick
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, qa.count);
    for (const q of picked) {
      usedIds.add(q.id);
      selected.push(q);
    }

    // If we couldn't get enough, backfill from used questions
    if (picked.length < qa.count) {
      const backfill = pool.questions
        .filter((q) => !picked.find((p) => p.id === q.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, qa.count - picked.length);
      for (const q of backfill) {
        usedIds.add(q.id);
        selected.push(q);
      }
    }
  }

  // Final shuffle
  selected.sort(() => Math.random() - 0.5);

  return {
    questions: selected,
    warnings,
    spec: config,
  };
}

/**
 * Create a new session state.
 */
export function createSession(
  questions: NormalizedQuestion[],
  config: SessionSpec
): SessionState {
  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    questionIds: questions.map((q) => q.id),
    answers: [],
    currentIndex: 0,
    config: { ...config, label: `${config.questionCount} questions / ${config.durationMinutes} min` },
    startTime: null,
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

/**
 * Score a completed session.
 */
export function scoreSession(
  session: SessionState,
  questions: NormalizedQuestion[]
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
    completedAt: Date.now(),
    preset: Object.entries(SESSION_CONFIG).find(
      ([, c]) => c.questionCount === totalQuestions
    )?.[0] as SessionPreset ?? "SHORT",
  };

  return { result, domainAnalytics };
}
