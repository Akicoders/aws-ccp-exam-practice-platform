import { describe, it, expect } from "vitest";
import {
  computeQuotas,
  computeLargestRemainderQuotas,
  sampleSession,
  createSession,
  recordIntegrityIncident,
  scoreSession,
} from "@/lib/quiz-engine";
import {
  type NormalizedQuestion,
  type QuestionData,
  type DomainPool,
  type Domain,
  type SessionPreset,
  DOMAIN,
  INTEGRITY_INCIDENT_TYPE,
  SESSION_CONFIG,
  SESSION_MODE,
  SESSION_PRESET,
} from "@/types/contracts";

function makePool(
  domain: Domain,
  count: number,
  startId = 1
): DomainPool {
  const questions: NormalizedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const id = `${domain}-${startId + i}`;
    questions.push({
      id,
      questionText: `Question ${id}`,
      multiSelect: false,
      optionA: "Option A",
      optionB: "Option B",
      optionC: "Option C",
      optionD: "Option D",
      optionE: "",
      optionF: "",
      correctAnswers: ["A"],
      times: 1,
      domain,
    });
  }
  return { domain, questions };
}

function makeData(pools: DomainPool[]): QuestionData {
  const byId: Record<string, NormalizedQuestion> = {};
  const totals: Record<string, number> = {};
  let grandTotal = 0;
  for (const pool of pools) {
    totals[pool.domain] = pool.questions.length;
    grandTotal += pool.questions.length;
    for (const q of pool.questions) {
      byId[q.id] = q;
    }
  }
  return { byId, pools, totals: totals as Record<Domain, number>, grandTotal };
}

describe("computeQuotas", () => {
  it("distributes questions proportionally across domains", () => {
    const poolSizes: Record<Domain, number> = {
      CLOUD_CONCEPTS: 100,
      SECURITY: 200,
      TECHNOLOGY_SERVICES: 150,
      BILLING_PRICING: 50,
    };
    const { quotas, warnings } = computeQuotas(20, poolSizes);
    expect(quotas.reduce((s, q) => s + q.count, 0)).toBe(20);
    expect(quotas.length).toBe(4);
  });

  it("warns when pool is running low", () => {
    const poolSizes: Record<Domain, number> = {
      CLOUD_CONCEPTS: 2,
      SECURITY: 100,
      TECHNOLOGY_SERVICES: 100,
      BILLING_PRICING: 50,
    };
    const { warnings } = computeQuotas(20, poolSizes);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("uses deterministic largest-remainder rounding for custom weights", () => {
    const quotas = computeLargestRemainderQuotas(10, {
      CLOUD_CONCEPTS: 24,
      SECURITY: 33,
      TECHNOLOGY_SERVICES: 26,
      BILLING_PRICING: 17,
    });

    expect(quotas).toEqual([
      { domain: DOMAIN.CLOUD_CONCEPTS, count: 2 },
      { domain: DOMAIN.SECURITY, count: 3 },
      { domain: DOMAIN.TECHNOLOGY_SERVICES, count: 3 },
      { domain: DOMAIN.BILLING_PRICING, count: 2 },
    ]);
    expect(quotas.reduce((sum, quota) => sum + quota.count, 0)).toBe(10);
  });
});

describe("sampleSession", () => {
  it("produces the correct number of questions", () => {
    const pools: DomainPool[] = [
      makePool(DOMAIN.CLOUD_CONCEPTS, 50),
      makePool(DOMAIN.SECURITY, 100),
      makePool(DOMAIN.TECHNOLOGY_SERVICES, 100),
      makePool(DOMAIN.BILLING_PRICING, 50),
    ];
    const data = makeData(pools);
    const { questions } = sampleSession(data, "SHORT");
    expect(questions.length).toBe(SESSION_CONFIG.SHORT.questionCount);
  });

  it("does not have duplicate question IDs", () => {
    const pools: DomainPool[] = [
      makePool(DOMAIN.CLOUD_CONCEPTS, 50),
      makePool(DOMAIN.SECURITY, 100),
      makePool(DOMAIN.TECHNOLOGY_SERVICES, 100),
      makePool(DOMAIN.BILLING_PRICING, 50),
    ];
    const data = makeData(pools);
    const { questions } = sampleSession(data, "FULL");
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });

  it("allows cross-session reuse of IDs", () => {
    // Different sessions can reuse same questions
    const pools: DomainPool[] = [
      makePool(DOMAIN.CLOUD_CONCEPTS, 50, 1),
      makePool(DOMAIN.SECURITY, 100, 1),
      makePool(DOMAIN.TECHNOLOGY_SERVICES, 100, 1),
      makePool(DOMAIN.BILLING_PRICING, 50, 1),
    ];
    const data = makeData(pools);
    const { questions: s1 } = sampleSession(data, "SHORT");
    const { questions: s2 } = sampleSession(data, "SHORT");
    // This should normally work since we don't pass previous IDs
    expect(s2.length).toBe(SESSION_CONFIG.SHORT.questionCount);
  });

  it("samples a custom distribution without duplicate IDs", () => {
    const pools: DomainPool[] = [
      makePool(DOMAIN.CLOUD_CONCEPTS, 20),
      makePool(DOMAIN.SECURITY, 20),
      makePool(DOMAIN.TECHNOLOGY_SERVICES, 20),
      makePool(DOMAIN.BILLING_PRICING, 20),
    ];
    const { questions, spec } = sampleSession(makeData(pools), {
      questionCount: 8,
      durationMinutes: 12,
      isCustom: true,
      domainWeights: {
        CLOUD_CONCEPTS: 50,
        SECURITY: 0,
        TECHNOLOGY_SERVICES: 25,
        BILLING_PRICING: 25,
      },
    });
    const counts = Object.fromEntries(
      pools.map((pool) => [pool.domain, questions.filter((question) => question.domain === pool.domain).length])
    );

    expect(spec.isCustom).toBe(true);
    expect(counts[DOMAIN.CLOUD_CONCEPTS]).toBe(4);
    expect(counts[DOMAIN.SECURITY]).toBe(0);
    expect(counts[DOMAIN.TECHNOLOGY_SERVICES]).toBe(2);
    expect(counts[DOMAIN.BILLING_PRICING]).toBe(2);
    expect(new Set(questions.map((question) => question.id)).size).toBe(8);
  });

  it("returns a recoverable warning instead of reusing IDs when a custom quota is unavailable", () => {
    const pools: DomainPool[] = [
      makePool(DOMAIN.CLOUD_CONCEPTS, 1),
      makePool(DOMAIN.SECURITY, 20),
      makePool(DOMAIN.TECHNOLOGY_SERVICES, 20),
      makePool(DOMAIN.BILLING_PRICING, 20),
    ];
    const { questions, warnings } = sampleSession(makeData(pools), {
      questionCount: 10,
      durationMinutes: 10,
      isCustom: true,
      domainWeights: {
        CLOUD_CONCEPTS: 50,
        SECURITY: 20,
        TECHNOLOGY_SERVICES: 20,
        BILLING_PRICING: 10,
      },
    });

    expect(questions.length).toBeLessThan(10);
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
    expect(warnings.some((warning) => warning.type === "unmet-quota")).toBe(true);
  });
});

describe("createSession and scoreSession", () => {
  it("records incidents only for simulation sessions and includes the count in results", () => {
    const question: NormalizedQuestion = {
      id: "q1",
      questionText: "Test?",
      multiSelect: false,
      optionA: "A",
      optionB: "B",
      optionC: "",
      optionD: "",
      optionE: "",
      optionF: "",
      correctAnswers: ["A"],
      times: 1,
      domain: DOMAIN.CLOUD_CONCEPTS,
    };
    const study = createSession([question], { questionCount: 1, durationMinutes: 10 });
    const simulation = createSession(
      [question],
      { questionCount: 1, durationMinutes: 10 },
      SESSION_MODE.SIMULATION
    );

    expect(recordIntegrityIncident(study, INTEGRITY_INCIDENT_TYPE.FOCUS_LOST, 1000)).toBe(study);
    const recorded = recordIntegrityIncident(
      simulation,
      INTEGRITY_INCIDENT_TYPE.FOCUS_LOST,
      1000
    );
    const { result } = scoreSession(recorded, [question], 2000);

    expect(recorded.integrityIncidents).toEqual([
      { type: INTEGRITY_INCIDENT_TYPE.FOCUS_LOST, timestamp: 1000 },
    ]);
    expect(result.mode).toBe(SESSION_MODE.SIMULATION);
    expect(result.integrityIncidentCount).toBe(1);

    const custom = createSession(
      [question],
      {
        questionCount: 1,
        durationMinutes: 7,
        isCustom: true,
        domainWeights: {
          CLOUD_CONCEPTS: 100,
          SECURITY: 0,
          TECHNOLOGY_SERVICES: 0,
          BILLING_PRICING: 0,
        },
      }
    );
    const { result: customResult } = scoreSession(custom, [question], 2000);
    expect(customResult.preset).toBe(SESSION_PRESET.CUSTOM);
    expect(customResult.config?.isCustom).toBe(true);
    expect(customResult.config?.domainWeights.CLOUD_CONCEPTS).toBe(100);
  });

  it("scores correctly with single-select answers", () => {
    const questions: NormalizedQuestion[] = [
      {
        id: "q1",
        questionText: "Test?",
        multiSelect: false,
        optionA: "A",
        optionB: "B",
        optionC: "",
        optionD: "",
        optionE: "",
        optionF: "",
        correctAnswers: ["A"],
        times: 1,
        domain: DOMAIN.CLOUD_CONCEPTS,
      },
      {
        id: "q2",
        questionText: "Test2?",
        multiSelect: false,
        optionA: "A",
        optionB: "B",
        optionC: "",
        optionD: "",
        optionE: "",
        optionF: "",
        correctAnswers: ["B"],
        times: 1,
        domain: DOMAIN.SECURITY,
      },
    ];

    const session = createSession(questions, {
      questionCount: 2,
      durationMinutes: 10,
    });

    const sessionWithAnswers = {
      ...session,
      answers: [
        { questionId: "q1", selected: ["A"] as any[] },
        { questionId: "q2", selected: ["A"] as any[] }, // wrong
      ],
    };

    const { result } = scoreSession(sessionWithAnswers, questions);
    expect(result.rawPoints).toBe(1);
    expect(result.correctCount).toBe(1);
    expect(result.totalQuestions).toBe(2);
    expect(result.percentage).toBe(50);
    expect(result.passed).toBe(false);
  });

  it("all-or-nothing multi-select scoring", () => {
    const questions: NormalizedQuestion[] = [
      {
        id: "q1",
        questionText: "Select all that apply?",
        multiSelect: true,
        optionA: "A",
        optionB: "B",
        optionC: "C",
        optionD: "",
        optionE: "",
        optionF: "",
        correctAnswers: ["A", "C"],
        times: 1,
        domain: DOMAIN.CLOUD_CONCEPTS,
      },
    ];

    const session = createSession(questions, {
      questionCount: 1,
      durationMinutes: 10,
    });

    // Partial correct - should be 0 (all or nothing)
    const partialAnswer = {
      ...session,
      answers: [{ questionId: "q1", selected: ["A"] as any[] }],
    };
    const { result: partialResult } = scoreSession(partialAnswer, questions);
    expect(partialResult.rawPoints).toBe(0);

    // Full correct
    const fullAnswer = {
      ...session,
      answers: [{ questionId: "q1", selected: ["A", "C"] as any[] }],
    };
    const { result: fullResult } = scoreSession(fullAnswer, questions);
    expect(fullResult.rawPoints).toBe(1);
  });

  it("70% inclusive pass threshold (14/20 = 70% passes)", () => {
    const questions: NormalizedQuestion[] = Array.from(
      { length: 20 },
      (_, i) => ({
        id: `q${i}`,
        questionText: `Question ${i}?`,
        multiSelect: false,
        optionA: "A",
        optionB: "B",
        optionC: "",
        optionD: "",
        optionE: "",
        optionF: "",
        correctAnswers: ["A"],
        times: 1,
        domain: DOMAIN.CLOUD_CONCEPTS,
      })
    );

    const session = createSession(questions, {
      questionCount: 20,
      durationMinutes: 20,
    });

    // 14/20 correct → 70% → pass
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      selected: (i < 14 ? ["A"] : ["B"]) as any[],
    }));
    const sessionWithAnswers = { ...session, answers };

    const { result } = scoreSession(sessionWithAnswers, questions);
    expect(result.rawPoints).toBe(14);
    expect(result.percentage).toBe(70);
    expect(result.passed).toBe(true);
  });

  it("69% fails (not inclusive below 70)", () => {
    const questions: NormalizedQuestion[] = Array.from(
      { length: 20 },
      (_, i) => ({
        id: `q${i}`,
        questionText: `Question ${i}?`,
        multiSelect: false,
        optionA: "A",
        optionB: "B",
        optionC: "",
        optionD: "",
        optionE: "",
        optionF: "",
        correctAnswers: ["A"],
        times: 1,
        domain: DOMAIN.CLOUD_CONCEPTS,
      })
    );

    const session = createSession(questions, {
      questionCount: 20,
      durationMinutes: 20,
    });

    const answers = questions.map((q, i) => ({
      questionId: q.id,
      selected: (i < 13 ? ["A"] : ["B"]) as any[],
    }));
    const sessionWithAnswers = { ...session, answers };

    const { result } = scoreSession(sessionWithAnswers, questions);
    expect(result.rawPoints).toBe(13);
    expect(result.percentage).toBe(65);
    expect(result.passed).toBe(false);
  });
});
