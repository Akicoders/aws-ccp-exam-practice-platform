import {
  type Domain,
  type DomainWeights,
  type SessionMode,
  type SessionSpec,
  DEFAULT_DOMAIN_WEIGHTS,
  DOMAIN,
  DOMAIN_ORDER,
  SESSION_MODE,
} from "@/types/contracts";

export const CUSTOM_EXAM_LIMITS = {
  MIN_DURATION_MINUTES: 1,
  MAX_DURATION_MINUTES: 180,
  MIN_QUESTION_COUNT: 1,
  MAX_QUESTION_COUNT: 100,
  MIN_PERCENTAGE: 0,
  MAX_PERCENTAGE: 100,
} as const;

export const CUSTOM_EXAM_FIELD = {
  DURATION_MINUTES: "durationMinutes",
  QUESTION_COUNT: "questionCount",
  MODE: "mode",
  DOMAIN_WEIGHTS: "domainWeights",
} as const;

export type CustomExamField = (typeof CUSTOM_EXAM_FIELD)[keyof typeof CUSTOM_EXAM_FIELD];

export const CUSTOM_EXAM_ERROR = {
  REQUIRED: "required",
  INTEGER: "integer",
  RANGE: "range",
  PERCENTAGE_SUM: "percentage-sum",
  MODE: "mode",
} as const;

export type CustomExamError = (typeof CUSTOM_EXAM_ERROR)[keyof typeof CUSTOM_EXAM_ERROR];

export interface CustomExamValues {
  durationMinutes: string | number;
  questionCount: string | number;
  mode: unknown;
  domainWeights: Readonly<Partial<Record<Domain, string | number>>>;
}

export interface CustomExamDraft {
  durationMinutes: string;
  questionCount: string;
  mode: SessionMode;
  domainWeights: Record<Domain, string>;
}

export interface CustomExamValidation {
  valid: boolean;
  errors: Partial<Record<CustomExamField, CustomExamError>>;
  totalPercentage: number | null;
  spec: SessionSpec | null;
}

export const DEFAULT_CUSTOM_EXAM_DRAFT: CustomExamDraft = {
  durationMinutes: "60",
  questionCount: "50",
  mode: SESSION_MODE.STUDY,
  domainWeights: {
    [DOMAIN.CLOUD_CONCEPTS]: String(DEFAULT_DOMAIN_WEIGHTS.CLOUD_CONCEPTS),
    [DOMAIN.SECURITY]: String(DEFAULT_DOMAIN_WEIGHTS.SECURITY),
    [DOMAIN.TECHNOLOGY_SERVICES]: String(DEFAULT_DOMAIN_WEIGHTS.TECHNOLOGY_SERVICES),
    [DOMAIN.BILLING_PRICING]: String(DEFAULT_DOMAIN_WEIGHTS.BILLING_PRICING),
  },
};

function parseInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "" || !/^-?\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && Number.isFinite(parsed) ? parsed : null;
}

function errorForInteger(value: unknown): CustomExamError {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "")
    ? CUSTOM_EXAM_ERROR.REQUIRED
    : CUSTOM_EXAM_ERROR.INTEGER;
}

export function validateCustomExam(values: CustomExamValues): CustomExamValidation {
  const errors: Partial<Record<CustomExamField, CustomExamError>> = {};
  const durationMinutes = parseInteger(values.durationMinutes);
  const questionCount = parseInteger(values.questionCount);

  if (durationMinutes === null) {
    errors[CUSTOM_EXAM_FIELD.DURATION_MINUTES] = errorForInteger(values.durationMinutes);
  } else if (
    durationMinutes < CUSTOM_EXAM_LIMITS.MIN_DURATION_MINUTES ||
    durationMinutes > CUSTOM_EXAM_LIMITS.MAX_DURATION_MINUTES
  ) {
    errors[CUSTOM_EXAM_FIELD.DURATION_MINUTES] = CUSTOM_EXAM_ERROR.RANGE;
  }

  if (questionCount === null) {
    errors[CUSTOM_EXAM_FIELD.QUESTION_COUNT] = errorForInteger(values.questionCount);
  } else if (
    questionCount < CUSTOM_EXAM_LIMITS.MIN_QUESTION_COUNT ||
    questionCount > CUSTOM_EXAM_LIMITS.MAX_QUESTION_COUNT
  ) {
    errors[CUSTOM_EXAM_FIELD.QUESTION_COUNT] = CUSTOM_EXAM_ERROR.RANGE;
  }

  const weights = {} as Record<Domain, number>;
  let totalPercentage = 0;
  let validWeights = true;
  for (const domain of DOMAIN_ORDER) {
    const value = values.domainWeights?.[domain] ?? "";
    const weight = parseInteger(value);
    if (weight === null) {
      validWeights = false;
      errors[CUSTOM_EXAM_FIELD.DOMAIN_WEIGHTS] ??= errorForInteger(value);
      continue;
    }
    if (
      weight < CUSTOM_EXAM_LIMITS.MIN_PERCENTAGE ||
      weight > CUSTOM_EXAM_LIMITS.MAX_PERCENTAGE
    ) {
      validWeights = false;
      errors[CUSTOM_EXAM_FIELD.DOMAIN_WEIGHTS] ??= CUSTOM_EXAM_ERROR.RANGE;
      continue;
    }
    weights[domain] = weight;
    totalPercentage += weight;
  }

  const hasPercentageError = errors[CUSTOM_EXAM_FIELD.DOMAIN_WEIGHTS] !== undefined;
  if (validWeights && totalPercentage !== 100) {
    errors[CUSTOM_EXAM_FIELD.DOMAIN_WEIGHTS] = CUSTOM_EXAM_ERROR.PERCENTAGE_SUM;
  }

  if (values.mode !== SESSION_MODE.STUDY && values.mode !== SESSION_MODE.SIMULATION) {
    errors[CUSTOM_EXAM_FIELD.MODE] = CUSTOM_EXAM_ERROR.MODE;
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    totalPercentage: hasPercentageError && !validWeights ? null : totalPercentage,
    spec: valid
      ? {
          questionCount: questionCount as number,
          durationMinutes: durationMinutes as number,
          label: "Custom exam",
          domainWeights: weights,
          isCustom: true,
        }
      : null,
  };
}

export function createCustomSessionSpec(values: CustomExamValues): SessionSpec | null {
  return validateCustomExam(values).spec;
}
