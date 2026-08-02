import { describe, expect, it } from "vitest";
import {
  CUSTOM_EXAM_ERROR,
  CUSTOM_EXAM_LIMITS,
  DEFAULT_CUSTOM_EXAM_DRAFT,
  validateCustomExam,
} from "@/lib/custom-exam";
import {
  DEFAULT_DOMAIN_WEIGHTS,
  DOMAIN,
  SESSION_MODE,
} from "@/types/contracts";

function validValues() {
  return {
    durationMinutes: DEFAULT_CUSTOM_EXAM_DRAFT.durationMinutes,
    questionCount: DEFAULT_CUSTOM_EXAM_DRAFT.questionCount,
    mode: SESSION_MODE.STUDY,
    domainWeights: DEFAULT_CUSTOM_EXAM_DRAFT.domainWeights,
  };
}

describe("custom exam validation", () => {
  it("accepts the official distribution and produces a custom session spec", () => {
    const validation = validateCustomExam(validValues());

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual({});
    expect(validation.spec).toMatchObject({
      questionCount: 50,
      durationMinutes: 60,
      isCustom: true,
      domainWeights: DEFAULT_DOMAIN_WEIGHTS,
    });
  });

  it("rejects empty, negative, fractional, and out-of-range values", () => {
    const validation = validateCustomExam({
      ...validValues(),
      durationMinutes: "",
      questionCount: "-1",
      domainWeights: {
        ...validValues().domainWeights,
        [DOMAIN.SECURITY]: "12.5",
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.durationMinutes).toBe(CUSTOM_EXAM_ERROR.REQUIRED);
    expect(validation.errors.questionCount).toBe(CUSTOM_EXAM_ERROR.RANGE);
    expect(validation.errors.domainWeights).toBe(CUSTOM_EXAM_ERROR.INTEGER);
  });

  it("enforces the documented bounds and an exact 100 percent sum", () => {
    const invalid = validateCustomExam({
      ...validValues(),
      durationMinutes: String(CUSTOM_EXAM_LIMITS.MAX_DURATION_MINUTES + 1),
      questionCount: String(CUSTOM_EXAM_LIMITS.MAX_QUESTION_COUNT + 1),
      domainWeights: {
        ...validValues().domainWeights,
        [DOMAIN.BILLING_PRICING]: "16",
      },
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.errors.durationMinutes).toBe(CUSTOM_EXAM_ERROR.RANGE);
    expect(invalid.errors.questionCount).toBe(CUSTOM_EXAM_ERROR.RANGE);
    expect(invalid.errors.domainWeights).toBe(CUSTOM_EXAM_ERROR.PERCENTAGE_SUM);
    expect(invalid.totalPercentage).toBe(99);
  });
});
