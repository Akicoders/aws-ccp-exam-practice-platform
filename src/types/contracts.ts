/* ======== Constants (const object pattern) ======== */

export const DOMAIN = {
  CLOUD_CONCEPTS: "CLOUD_CONCEPTS",
  SECURITY: "SECURITY",
  TECHNOLOGY_SERVICES: "TECHNOLOGY_SERVICES",
  BILLING_PRICING: "BILLING_PRICING",
} as const;

export type Domain = (typeof DOMAIN)[keyof typeof DOMAIN];

/** CLF-C02 target proportions */
export const DOMAIN_TARGETS: Record<Domain, number> = {
  CLOUD_CONCEPTS: 0.24,
  SECURITY: 0.33,
  TECHNOLOGY_SERVICES: 0.26,
  BILLING_PRICING: 0.17,
} as const;

/** Official CLF-C02 distribution as whole-number percentages. */
export const DEFAULT_DOMAIN_WEIGHTS = {
  CLOUD_CONCEPTS: 24,
  SECURITY: 33,
  TECHNOLOGY_SERVICES: 26,
  BILLING_PRICING: 17,
} as const;

export type DomainWeights = Readonly<Record<Domain, number>>;

/** Maps CSV domain names to our internal keys */
export const CSV_DOMAIN_MAP: Record<string, Domain> = {
  "Cloud Concepts": DOMAIN.CLOUD_CONCEPTS,
  "Security and Compliance": DOMAIN.SECURITY,
  "Cloud Technology and Services": DOMAIN.TECHNOLOGY_SERVICES,
  "Billing, Pricing, and Support": DOMAIN.BILLING_PRICING,
} as const;

export const LOCALE = { EN: "en", ES: "es" } as const;
export type Locale = (typeof LOCALE)[keyof typeof LOCALE];

export const OPTION_LETTER = {
  A: "A", B: "B", C: "C", D: "D", E: "E", F: "F",
} as const;
export type OptionLetter = (typeof OPTION_LETTER)[keyof typeof OPTION_LETTER];

export const SESSION_PRESET = {
  SHORT: "SHORT",
  MEDIUM: "MEDIUM",
  FULL: "FULL",
  CUSTOM: "CUSTOM",
} as const;

export type SessionPreset = Exclude<
  (typeof SESSION_PRESET)[keyof typeof SESSION_PRESET],
  typeof SESSION_PRESET.CUSTOM
>;

export type StoredSessionPreset = (typeof SESSION_PRESET)[keyof typeof SESSION_PRESET];

export const SESSION_CONFIG = {
  SHORT: {
    questionCount: 10,
    durationMinutes: 10,
    label: "10 questions / 10 min",
    domainWeights: DEFAULT_DOMAIN_WEIGHTS,
    isCustom: false,
  },
  MEDIUM: {
    questionCount: 20,
    durationMinutes: 20,
    label: "20 questions / 20 min",
    domainWeights: DEFAULT_DOMAIN_WEIGHTS,
    isCustom: false,
  },
  FULL: {
    questionCount: 50,
    durationMinutes: 60,
    label: "50 questions / 60 min",
    domainWeights: DEFAULT_DOMAIN_WEIGHTS,
    isCustom: false,
  },
} as const;

export const SESSION_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  TIMED_OUT: "timed-out",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const SESSION_MODE = {
  STUDY: "study",
  SIMULATION: "simulation",
} as const;

export type SessionMode = (typeof SESSION_MODE)[keyof typeof SESSION_MODE];

export const INTEGRITY_INCIDENT_TYPE = {
  VISIBILITY_HIDDEN: "visibility-hidden",
  FOCUS_LOST: "focus-lost",
} as const;

export type IntegrityIncidentType =
  (typeof INTEGRITY_INCIDENT_TYPE)[keyof typeof INTEGRITY_INCIDENT_TYPE];

export const THEME = { LIGHT: "light", DARK: "dark" } as const;
export type Theme = (typeof THEME)[keyof typeof THEME];

export const STORAGE_KEY = "aws-ccp-exam:v1";

/** Domains in display order */
export const DOMAIN_ORDER: Domain[] = [
  DOMAIN.CLOUD_CONCEPTS,
  DOMAIN.SECURITY,
  DOMAIN.TECHNOLOGY_SERVICES,
  DOMAIN.BILLING_PRICING,
];

export const DOMAIN_LABELS: Record<Domain, string> = {
  CLOUD_CONCEPTS: "Cloud Concepts",
  SECURITY: "Security and Compliance",
  TECHNOLOGY_SERVICES: "Cloud Technology and Services",
  BILLING_PRICING: "Billing, Pricing, and Support",
};

/* ======== Flat serializable interfaces ======== */

export interface NormalizedQuestion {
  id: string;
  questionText: string;
  multiSelect: boolean;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  optionF: string;
  correctAnswers: OptionLetter[];
  times: number;
  domain: Domain;
}

export const TRANSLATION_SOURCE = {
  ENGLISH_SOURCE: "english-source",
  REVIEWED_SPANISH: "reviewed-spanish",
  ENGLISH_FALLBACK: "english-fallback",
} as const;

export type TranslationSource = (typeof TRANSLATION_SOURCE)[keyof typeof TRANSLATION_SOURCE];

export interface QuestionTranslation {
  questionText: string;
  options: Partial<Record<OptionLetter, string>>;
}

export interface QuestionCopy {
  questionText: string;
  options: Partial<Record<OptionLetter, string>>;
  source: TranslationSource;
}

export interface DomainPool {
  domain: Domain;
  questions: NormalizedQuestion[];
}

export interface PoolIndex {
  pools: DomainPool[];
  generatedAt: string;
  totals: Record<Domain, number>;
  grandTotal: number;
}

export interface AnswerRecord {
  questionId: string;
  selected: OptionLetter[];
}

export interface AnswerResult extends AnswerRecord {
  correctAnswers: OptionLetter[];
  isCorrect: boolean;
}

export interface SessionConfig {
  questionCount: number;
  durationMinutes: number;
  label: string;
  domainWeights: DomainWeights;
  isCustom: boolean;
}

export interface SessionSpec {
  questionCount: number;
  durationMinutes: number;
  label?: string;
  domainWeights?: DomainWeights;
  isCustom?: boolean;
}

export interface IntegrityIncident {
  type: IntegrityIncidentType;
  timestamp: number;
}

export interface SessionState {
  id: string;
  questionIds: string[];
  answers: AnswerRecord[];
  currentIndex: number;
  config: SessionConfig;
  mode: SessionMode;
  startTime: number | null;
  elapsedVisibleMs: number;
  visibleSince: number | null;
  integrityIncidents: IntegrityIncident[];
  status: SessionStatus;
}

export interface SessionResult {
  sessionId: string;
  rawPoints: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  answers: AnswerResult[];
  timeSpentMs: number;
  completedAt: number;
  preset: StoredSessionPreset;
  mode: SessionMode;
  integrityIncidentCount: number;
  config?: SessionConfig;
}

export interface DomainAnalytics {
  domain: Domain;
  correct: number;
  total: number;
  timestamp: number;
}

export interface BrowserStore {
  activeSessionId: string | null;
  sessions: SessionState[];
  results: SessionResult[];
  analytics: DomainAnalytics[];
  locale: Locale;
  theme: Theme;
}

export interface ExplanationEntry {
  questionId: string;
  domain: Domain;
  explanation: string;
}

export interface QuestionData {
  byId: Record<string, NormalizedQuestion>;
  pools: DomainPool[];
  totals: Record<Domain, number>;
  grandTotal: number;
}

export const DISCLAIMER_TEXT =
  "This score is an approximation and does NOT represent official AWS exam results. The AWS Certified Cloud Practitioner exam requires a scaled score of 700/1000.";

export const EXPLANATION_UNAVAILABLE =
  "Explanation not available in this practice set.";

export const LOW_POOL_WARNING =
  "Some domains are running low on fresh questions.";
