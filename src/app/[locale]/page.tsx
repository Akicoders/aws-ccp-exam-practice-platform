"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "./locale-layout-client";
import {
  type Domain,
  type SessionMode,
  SESSION_CONFIG,
  SESSION_MODE,
  type SessionPreset,
  DOMAIN_TARGETS,
  DOMAIN_ORDER,
  DEFAULT_DOMAIN_WEIGHTS,
  DISCLAIMER_TEXT,
} from "@/types/contracts";
import Disclaimer from "@/components/disclaimer";
import {
  CUSTOM_EXAM_ERROR,
  CUSTOM_EXAM_FIELD,
  CUSTOM_EXAM_LIMITS,
  DEFAULT_CUSTOM_EXAM_DRAFT,
  type CustomExamDraft,
  validateCustomExam,
} from "@/lib/custom-exam";
import { computeLargestRemainderQuotas } from "@/lib/quiz-engine";

const PRESET_KEYS = Object.keys(SESSION_CONFIG) as SessionPreset[];

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const router = useRouter();
  const msg = useMessages(locale);
  const [mode, setMode] = useState<SessionMode>(SESSION_MODE.STUDY);
  const [customDraft, setCustomDraft] = useState<CustomExamDraft>(() => ({
    ...DEFAULT_CUSTOM_EXAM_DRAFT,
    domainWeights: { ...DEFAULT_CUSTOM_EXAM_DRAFT.domainWeights },
  }));

  const startSession = useCallback(
    (preset: SessionPreset) => {
      const key = preset.toLowerCase();
      router.push(`/${locale}/session?preset=${key}&mode=${mode}`);
    },
    [locale, mode, router]
  );

  const customValidation = validateCustomExam({
    durationMinutes: customDraft.durationMinutes,
    questionCount: customDraft.questionCount,
    mode,
    domainWeights: customDraft.domainWeights,
  });
  const customQuotas = customValidation.spec
    ? computeLargestRemainderQuotas(
        customValidation.spec.questionCount,
        customValidation.spec.domainWeights
      )
    : [];
  const customQuestionTotal = customQuotas.reduce((sum, quota) => sum + quota.count, 0);
  const questionLabel = (count: number) =>
    count === 1 ? msg.home.customExam.question : msg.home.customExam.questions;

  const getCustomError = (field: typeof CUSTOM_EXAM_FIELD[keyof typeof CUSTOM_EXAM_FIELD]) => {
    const error = customValidation.errors[field];
    if (!error) return null;
    if (error === CUSTOM_EXAM_ERROR.REQUIRED) return msg.home.customExam.required;
    if (error === CUSTOM_EXAM_ERROR.INTEGER) return msg.home.customExam.integer;
    if (error === CUSTOM_EXAM_ERROR.PERCENTAGE_SUM) return msg.home.customExam.percentageSum;
    if (error === CUSTOM_EXAM_ERROR.MODE) return msg.home.customExam.modeInvalid;
    if (field === CUSTOM_EXAM_FIELD.DURATION_MINUTES) return msg.home.customExam.durationRange;
    if (field === CUSTOM_EXAM_FIELD.QUESTION_COUNT) return msg.home.customExam.questionRange;
    return msg.home.customExam.percentageRange;
  };

  const updateCustomDraft = (field: "durationMinutes" | "questionCount", value: string) => {
    setCustomDraft((previous) => ({ ...previous, [field]: value }));
  };

  const updateDomainWeight = (domain: Domain, value: string) => {
    setCustomDraft((previous) => ({
      ...previous,
      domainWeights: { ...previous.domainWeights, [domain]: value },
    }));
  };

  const startCustomExam = () => {
    if (!customValidation.valid || !customValidation.spec) return;
    const params = new URLSearchParams({
      preset: "custom",
      duration: String(customValidation.spec.durationMinutes),
      questions: String(customValidation.spec.questionCount),
      mode,
    });
    for (const domain of DOMAIN_ORDER) {
      params.set(
        domain.toLowerCase(),
        String(customValidation.spec.domainWeights?.[domain] ?? DEFAULT_DOMAIN_WEIGHTS[domain])
      );
    }
    router.push(`/${locale}/session?${params.toString()}`);
  };

  const resetCustomDistribution = () => {
    setCustomDraft((previous) => ({
      ...previous,
      domainWeights: { ...DEFAULT_CUSTOM_EXAM_DRAFT.domainWeights },
    }));
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{msg.home.title}</h1>
        <p className="text-lg text-text-secondary dark:text-text-dark-secondary">
          {msg.home.subtitle}
        </p>
        <p className="text-sm text-text-secondary dark:text-text-dark-secondary max-w-2xl mx-auto">
          {msg.home.description}
        </p>
      </div>

      <div className="text-center text-xs text-text-secondary dark:text-text-dark-secondary">
        <strong>CLF-C02 Domain Targets:</strong>{" "}
        {Object.entries(DOMAIN_TARGETS)
          .map(([k, v]) => `${k.replace(/_/g, " ")} ${Math.round(v * 100)}%`)
          .join(" | ")}
      </div>

      <section className="space-y-3" aria-labelledby="session-mode-title">
        <h2 id="session-mode-title" className="text-xl font-semibold text-center">
          {msg.home.selectMode}
        </h2>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">{msg.home.selectMode}</legend>
          <label className="flex cursor-pointer gap-3 rounded-xl border border-border bg-surface-alt p-4 transition-colors hover:border-brand-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 dark:border-border-dark dark:bg-surface-dark-alt">
            <input
              type="radio"
              name="session-mode"
              value={SESSION_MODE.STUDY}
              checked={mode === SESSION_MODE.STUDY}
              onChange={() => setMode(SESSION_MODE.STUDY)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block font-semibold">{msg.home.studyMode}</span>
              <span className="mt-1 block text-sm text-text-secondary dark:text-text-dark-secondary">
                {msg.home.studyModeDescription}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-xl border border-border bg-surface-alt p-4 transition-colors hover:border-brand-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 dark:border-border-dark dark:bg-surface-dark-alt">
            <input
              type="radio"
              name="session-mode"
              value={SESSION_MODE.SIMULATION}
              checked={mode === SESSION_MODE.SIMULATION}
              onChange={() => setMode(SESSION_MODE.SIMULATION)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block font-semibold">{msg.home.simulationMode}</span>
              <span className="mt-1 block text-sm text-text-secondary dark:text-text-dark-secondary">
                {msg.home.simulationModeDescription}
              </span>
            </span>
          </label>
        </fieldset>
      </section>

      <h2 className="text-xl font-semibold text-center">{msg.home.selectPreset}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {PRESET_KEYS.map((key) => {
          const config = SESSION_CONFIG[key];
          const description = key === "SHORT"
            ? msg.home.shortDesc
            : key === "MEDIUM"
              ? msg.home.mediumDesc
              : msg.home.fullDesc;
          return (
            <button
              key={key}
              onClick={() => startSession(key)}
              className="min-h-11 rounded-xl border border-border bg-surface-alt p-6 text-left transition-[border-color,box-shadow] hover:border-brand-500 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-border-dark dark:bg-surface-dark-alt"
            >
              <h3 className="font-semibold text-lg mb-1">{config.label}</h3>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                {description}
              </p>
            </button>
          );
        })}
      </div>

      <section
        className="space-y-5 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-900/10 sm:p-6"
        aria-labelledby="custom-exam-title"
      >
        <div className="space-y-2">
          <h2 id="custom-exam-title" className="text-xl font-semibold">
            {msg.home.customExam.title}
          </h2>
          <p className="text-sm leading-6 text-text-secondary dark:text-text-dark-secondary">
            {msg.home.customExam.description}
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            startCustomExam();
          }}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="custom-duration" className="block text-sm font-medium">
                {msg.home.customExam.durationMinutes}
              </label>
              <input
                id="custom-duration"
                name="durationMinutes"
                type="number"
                inputMode="numeric"
                min={CUSTOM_EXAM_LIMITS.MIN_DURATION_MINUTES}
                max={CUSTOM_EXAM_LIMITS.MAX_DURATION_MINUTES}
                step="1"
                autoComplete="off"
                value={customDraft.durationMinutes}
                onChange={(event) => updateCustomDraft("durationMinutes", event.currentTarget.value)}
                aria-invalid={Boolean(getCustomError(CUSTOM_EXAM_FIELD.DURATION_MINUTES))}
                aria-describedby="custom-duration-error"
                className="min-h-11 w-full touch-manipulation rounded-lg border border-border bg-surface px-3 py-2 tabular-nums dark:border-border-dark dark:bg-surface-dark"
              />
              <p id="custom-duration-error" role="alert" className="min-h-5 text-sm text-red-700 dark:text-red-300">
                {getCustomError(CUSTOM_EXAM_FIELD.DURATION_MINUTES) ?? ""}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="custom-question-count" className="block text-sm font-medium">
                {msg.home.customExam.questionCount}
              </label>
              <input
                id="custom-question-count"
                name="questionCount"
                type="number"
                inputMode="numeric"
                min={CUSTOM_EXAM_LIMITS.MIN_QUESTION_COUNT}
                max={CUSTOM_EXAM_LIMITS.MAX_QUESTION_COUNT}
                step="1"
                autoComplete="off"
                value={customDraft.questionCount}
                onChange={(event) => updateCustomDraft("questionCount", event.currentTarget.value)}
                aria-invalid={Boolean(getCustomError(CUSTOM_EXAM_FIELD.QUESTION_COUNT))}
                aria-describedby="custom-question-count-error"
                className="min-h-11 w-full touch-manipulation rounded-lg border border-border bg-surface px-3 py-2 tabular-nums dark:border-border-dark dark:bg-surface-dark"
              />
              <p id="custom-question-count-error" role="alert" className="min-h-5 text-sm text-red-700 dark:text-red-300">
                {getCustomError(CUSTOM_EXAM_FIELD.QUESTION_COUNT) ?? ""}
              </p>
            </div>
          </div>

          <div className="space-y-2 sm:max-w-sm">
            <label htmlFor="custom-mode" className="block text-sm font-medium">
              {msg.home.customExam.mode}
            </label>
            <select
              id="custom-mode"
              name="mode"
              autoComplete="off"
              value={mode}
              onChange={(event) => setMode(
                event.currentTarget.value === SESSION_MODE.SIMULATION
                  ? SESSION_MODE.SIMULATION
                  : SESSION_MODE.STUDY
              )}
              className="min-h-11 w-full touch-manipulation rounded-lg border border-border bg-surface px-3 py-2 dark:border-border-dark dark:bg-surface-dark"
            >
              <option value={SESSION_MODE.STUDY}>{msg.home.customExam.studyMode}</option>
              <option value={SESSION_MODE.SIMULATION}>{msg.home.customExam.simulationMode}</option>
            </select>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              {msg.home.customExam.domainDistribution} ({msg.home.customExam.percentage})
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {DOMAIN_ORDER.map((domain) => {
                const inputId = `custom-${domain.toLowerCase()}`;
                return (
                  <div key={domain} className="space-y-2">
                    <label htmlFor={inputId} className="block text-sm">
                      {msg.home.customExam.domainLabels[domain]}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={inputId}
                        name={`percentage-${domain.toLowerCase()}`}
                        type="number"
                        inputMode="numeric"
                        min={CUSTOM_EXAM_LIMITS.MIN_PERCENTAGE}
                        max={CUSTOM_EXAM_LIMITS.MAX_PERCENTAGE}
                        step="1"
                        autoComplete="off"
                        value={customDraft.domainWeights[domain]}
                        onChange={(event) => updateDomainWeight(domain, event.currentTarget.value)}
                        aria-invalid={Boolean(getCustomError(CUSTOM_EXAM_FIELD.DOMAIN_WEIGHTS))}
                        aria-describedby="custom-domain-error"
                        className="min-h-11 w-full touch-manipulation rounded-lg border border-border bg-surface px-3 py-2 tabular-nums dark:border-border-dark dark:bg-surface-dark"
                      />
                      <span aria-hidden="true" className="text-sm font-medium">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p id="custom-domain-error" role="alert" aria-live="polite" className="min-h-5 text-sm text-red-700 dark:text-red-300">
              {getCustomError(CUSTOM_EXAM_FIELD.DOMAIN_WEIGHTS) ?? ""}
            </p>
          </fieldset>

          <section className="rounded-lg border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark" aria-labelledby="custom-preview-title">
            <div className="space-y-2">
              <h3 id="custom-preview-title" className="font-semibold">{msg.home.customExam.preview}</h3>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                {msg.home.customExam.previewIntro}
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {DOMAIN_ORDER.map((domain) => {
                const quota = customQuotas.find((item) => item.domain === domain)?.count ?? 0;
                return (
                  <div key={domain} className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-surface-alt px-3 py-2 text-sm dark:bg-surface-dark-alt">
                    <span className="min-w-0 break-words">{msg.home.customExam.domainLabels[domain]}</span>
                    <span className="shrink-0 tabular-nums">{quota} {questionLabel(quota)}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm font-semibold dark:border-border-dark sm:col-span-2">
                <span>{msg.home.customExam.total}</span>
                <span className="tabular-nums">
                  {customQuestionTotal} {questionLabel(customQuestionTotal)}
                </span>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={resetCustomDistribution}
              className="min-h-11 touch-manipulation rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface dark:border-border-dark dark:hover:bg-surface-dark-alt"
            >
              {msg.home.customExam.reset}
            </button>
            <button
              type="submit"
              disabled={!customValidation.valid}
              className="min-h-11 touch-manipulation rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {msg.home.customExam.start}
            </button>
          </div>
        </form>
      </section>

      <Disclaimer text={DISCLAIMER_TEXT} />
    </div>
  );
}
