"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMessages } from "../locale-layout-client";
import QuestionCard from "@/components/question-card";
import Disclaimer from "@/components/disclaimer";
import SessionLoading from "@/components/session-loading";
import {
  type Domain,
  type Locale,
  type NormalizedQuestion,
  type OptionLetter,
  type IntegrityIncidentType,
  type SessionPreset,
  type SessionState,
  DOMAIN_ORDER,
  DEFAULT_DOMAIN_WEIGHTS,
  SESSION_CONFIG,
  SESSION_MODE,
  SESSION_STATUS,
  INTEGRITY_INCIDENT_TYPE,
  DISCLAIMER_TEXT,
  TRANSLATION_SOURCE,
} from "@/types/contracts";
import { createCustomSessionSpec } from "@/lib/custom-exam";
import { loadQuestionPools } from "@/data/questions/index";
import { getQuestionCopy } from "@/data/questions/translations";
import {
  getSessionRemainingMs,
  getSessionWarnings,
  shouldExpireSession,
  startSessionTimer,
  updateSessionVisibility,
} from "@/lib/timer";
import { loadStore, saveStore, upsertSession, addResult, mergeDomainAnalytics } from "@/lib/browser-store";
import {
  createSession,
  recordAnswer,
  recordIntegrityIncident,
  sampleSession,
  scoreSession,
} from "@/lib/quiz-engine";

const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export default function SessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const msg = useMessages(locale);
  const localeValue = locale as Locale;
  const sessionIdFromUrl = searchParams.get("sessionId");
  const rawPreset = searchParams.get("preset") || "short";
  const isCustomPreset = rawPreset.toLowerCase() === "custom";
  const presetKey = rawPreset.toUpperCase() as SessionPreset;
  const sessionMode = searchParams.get("mode") === SESSION_MODE.SIMULATION
    ? SESSION_MODE.SIMULATION
    : SESSION_MODE.STUDY;
  const customSpec = isCustomPreset
    ? createCustomSessionSpec({
        durationMinutes: searchParams.get("duration") ?? "",
        questionCount: searchParams.get("questions") ?? "",
        mode: sessionMode,
        domainWeights: {
          CLOUD_CONCEPTS: searchParams.get("cloud_concepts") ?? "",
          SECURITY: searchParams.get("security") ?? "",
          TECHNOLOGY_SERVICES: searchParams.get("technology_services") ?? "",
          BILLING_PRICING: searchParams.get("billing_pricing") ?? "",
        },
      })
    : null;
  const config = customSpec ?? SESSION_CONFIG[presetKey] ?? SESSION_CONFIG.SHORT;
  const domainWeights = config.domainWeights ?? DEFAULT_DOMAIN_WEIGHTS;
  const configKey = [
    config.questionCount,
    config.durationMinutes,
    config.isCustom ? "custom" : "preset",
    ...DOMAIN_ORDER.map((domain) => domainWeights[domain]),
  ].join(":");

  const [session, setSession] = useState<SessionState | null>(null);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState(formatTime(config.durationMinutes * 60));
  const [timerHidden, setTimerHidden] = useState(false);
  const [warnings, setWarnings] = useState({ warned5: false, warned2: false, warned1: false });
  const [confirming, setConfirming] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [integrityWarning, setIntegrityWarning] = useState(false);

  const sessionRef = useRef<SessionState | null>(null);
  const submitRef = useRef<((isAutoSubmit?: boolean) => void) | null>(null);
  const submittingRef = useRef(false);
  const advanceTimeoutRef = useRef<number | null>(null);
  const awaySignalRef = useRef<IntegrityIncidentType | null>(null);

  const persistSession = useCallback(
    (nextSession: SessionState) => {
      try {
        const store = loadStore(localeValue, "light");
        saveStore(upsertSession(store, nextSession));
      } catch {
        // localStorage can be unavailable in private browsing or when full.
      }
    },
    [localeValue]
  );

  const updateTimerView = useCallback((nextSession: SessionState, now: number) => {
    const remainingMs = getSessionRemainingMs(nextSession, now);
    setTimerDisplay(formatTime(Math.ceil(remainingMs / 1000)));
    setWarnings(getSessionWarnings(nextSession, now));
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const store = loadStore(localeValue, "light");
        const pools = await loadQuestionPools();
        if (!active) return;

        if (isCustomPreset && !customSpec) {
          setError(msg.session.invalidCustomConfig);
          setLoading(false);
          return;
        }

        const existing = sessionIdFromUrl
          ? store.sessions.find((candidate) => candidate.id === sessionIdFromUrl)
          : null;

        if (
          existing &&
          (existing.status === SESSION_STATUS.ACTIVE || existing.status === SESSION_STATUS.PAUSED) &&
          existing.config.questionCount === config.questionCount &&
          existing.config.durationMinutes === config.durationMinutes &&
          existing.config.isCustom === config.isCustom &&
          DOMAIN_ORDER.every(
            (domain) => existing.config.domainWeights[domain] === domainWeights[domain]
          ) &&
          (!searchParams.has("mode") || existing.mode === sessionMode)
        ) {
          const questionMap = new Map(
            pools.flatMap((pool) => pool.questions.map((question) => [question.id, question] as const))
          );
          const resumedQuestions = existing.questionIds
            .map((questionId) => questionMap.get(questionId))
            .filter((question): question is NormalizedQuestion => question !== undefined);

          if (resumedQuestions.length === existing.questionIds.length) {
            const resumed = updateSessionVisibility(existing, document.hidden, Date.now());
            const safeIndex = Math.min(resumed.currentIndex, resumedQuestions.length - 1);
            const normalizedSession = safeIndex === resumed.currentIndex
              ? resumed
              : { ...resumed, currentIndex: safeIndex };
            sessionRef.current = normalizedSession;
            setSession(normalizedSession);
            setQuestions(resumedQuestions);
            setTimerHidden(document.hidden);
            updateTimerView(normalizedSession, Date.now());
            persistSession(normalizedSession);
            setLoading(false);
            return;
          }
        }

        const { questions: sampled, warnings: samplingWarnings, spec } = sampleSession(
          { pools },
          isCustomPreset && customSpec ? customSpec : presetKey
        );

        if (samplingWarnings.some((warning) => warning.type === "unmet-quota")) {
          setError("Could not generate a valid session with unique questions. Try a shorter session.");
          setLoading(false);
          return;
        }

        const newSession = createSession(sampled, spec, sessionMode);
        sessionRef.current = newSession;
        setSession(newSession);
        setQuestions(sampled);
        persistSession(newSession);
        const nextParams = new URLSearchParams({
          preset: isCustomPreset ? "custom" : presetKey.toLowerCase(),
          sessionId: newSession.id,
          mode: sessionMode,
        });
        if (isCustomPreset) {
          nextParams.set("duration", String(spec.durationMinutes));
          nextParams.set("questions", String(spec.questionCount));
          for (const domain of DOMAIN_ORDER) {
            nextParams.set(domain.toLowerCase(), String(spec.domainWeights?.[domain] ?? 0));
          }
        }
        router.replace(`/${locale}/session?${nextParams.toString()}`, { scroll: false });
        setLoading(false);
      } catch {
        if (!active) return;
        setError("Failed to start session. Please try again.");
        setLoading(false);
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [configKey, isCustomPreset, locale, localeValue, msg.session.invalidCustomConfig, persistSession, presetKey, router, sessionIdFromUrl, sessionMode, searchParams, updateTimerView]);

  const handleFirstAnswer = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.startTime !== null) return;

    const now = Date.now();
    const started = startSessionTimer(current, now);
    sessionRef.current = started;
    setSession(started);
    persistSession(started);
    updateTimerView(started, now);
  }, [persistSession, updateTimerView]);

  const handleAnswer = useCallback(
    (questionId: string, selected: OptionLetter[]) => {
      if (!sessionRef.current) return;
      handleFirstAnswer();

      const updated = recordAnswer(sessionRef.current, questionId, selected);
      sessionRef.current = updated;
      setSession(updated);
      persistSession(updated);
    },
    [handleFirstAnswer, persistSession]
  );

  const handleSubmit = useCallback(
    (isAutoSubmit = false) => {
      if (submittingRef.current || !sessionRef.current || questions.length === 0) return;
      submittingRef.current = true;
      if (isAutoSubmit) setAutoSubmitted(true);

      const completedAt = Date.now();
      const { result, domainAnalytics } = scoreSession(
        sessionRef.current,
        questions,
        completedAt
      );
      try {
        const store = loadStore(localeValue, "light");
        const mergedAnalytics = mergeDomainAnalytics(store.analytics, domainAnalytics);
        saveStore(addResult({ ...store, analytics: mergedAnalytics }, result));
      } catch {
        // Results remain available in memory for the route transition.
      }

      router.push(`/${locale}/results?sessionId=${encodeURIComponent(result.sessionId)}`);
    },
    [locale, localeValue, questions, router]
  );

  submitRef.current = handleSubmit;

  useEffect(() => {
    if (!session || loading) return;

    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    const tick = () => {
      const current = sessionRef.current;
      if (!current) return;
      const now = Date.now();
      updateTimerView(current, now);

      if (shouldExpireSession(current, now)) {
        submitRef.current?.(true);
      }
    };

    const handleVisibility = () => {
      const current = sessionRef.current;
      if (!current) return;

      let updated = current;
      if (
        document.hidden &&
        current.mode === SESSION_MODE.SIMULATION &&
        current.startTime !== null &&
        awaySignalRef.current === null
      ) {
        updated = recordIntegrityIncident(
          updated,
          INTEGRITY_INCIDENT_TYPE.VISIBILITY_HIDDEN,
          Date.now()
        );
        awaySignalRef.current = INTEGRITY_INCIDENT_TYPE.VISIBILITY_HIDDEN;
      }

      updated = updateSessionVisibility(updated, document.hidden, Date.now());
      if (updated !== current) {
        sessionRef.current = updated;
        setSession(updated);
        persistSession(updated);
      }

      if (!document.hidden && awaySignalRef.current !== null) {
        setIntegrityWarning(true);
        awaySignalRef.current = null;
      }
      setTimerHidden(document.hidden);
      tick();
    };

    const handleBlur = () => {
      const current = sessionRef.current;
      if (
        !current ||
        document.hidden ||
        isCoarsePointer ||
        current.mode !== SESSION_MODE.SIMULATION ||
        current.startTime === null ||
        awaySignalRef.current !== null
      ) {
        return;
      }

      const updated = recordIntegrityIncident(
        current,
        INTEGRITY_INCIDENT_TYPE.FOCUS_LOST,
        Date.now()
      );
      awaySignalRef.current = INTEGRITY_INCIDENT_TYPE.FOCUS_LOST;
      sessionRef.current = updated;
      setSession(updated);
      persistSession(updated);
      tick();
    };

    const handleFocus = () => {
      if (awaySignalRef.current !== null) {
        setIntegrityWarning(true);
        awaySignalRef.current = null;
      }
      tick();
    };

    setTimerHidden(document.hidden);
    tick();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    const interval = window.setInterval(tick, 250);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loading, persistSession, session?.id, updateTimerView]);

  const clearPendingAdvance = useCallback(() => {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    setAdvancing(false);
  }, []);

  useEffect(() => clearPendingAdvance, [clearPendingAdvance]);

  const moveToQuestion = useCallback(
    (index: number) => {
      const current = sessionRef.current;
      if (!current || questions.length === 0) return;
      clearPendingAdvance();
      const nextIndex = Math.max(0, Math.min(index, questions.length - 1));
      if (nextIndex === current.currentIndex) return;

      const updated = { ...current, currentIndex: nextIndex };
      sessionRef.current = updated;
      setSession(updated);
      persistSession(updated);
    },
    [clearPendingAdvance, persistSession, questions.length]
  );

  if (loading) {
    return <SessionLoading label={msg.common.loading} />;
  }

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {msg.session.goHome}
        </button>
      </div>
    );
  }

  if (!session || questions.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-text-secondary dark:text-text-dark-secondary">{msg.session.missingSession}</p>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {msg.session.goHome}
        </button>
      </div>
    );
  }

  const currentIndex = session.currentIndex;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = session.answers.find((answer) => answer.questionId === currentQuestion.id);
  const answeredCount = session.answers.filter((answer) => answer.selected.length > 0).length;
  const currentCopy = getQuestionCopy(currentQuestion, localeValue);
  const actualDomainCounts = DOMAIN_ORDER.reduce((counts, domain) => {
    counts[domain] = questions.filter((question) => question.domain === domain).length;
    return counts;
  }, {} as Record<Domain, number>);

  const handleOptionSelect = (option: OptionLetter) => {
    const selected = currentAnswer?.selected ?? [];
    const nextSelected = currentQuestion.multiSelect
      ? selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option]
      : [option];

    handleAnswer(currentQuestion.id, nextSelected);

    if (!currentQuestion.multiSelect && currentIndex < questions.length - 1) {
      clearPendingAdvance();
      setAdvancing(true);
      advanceTimeoutRef.current = window.setTimeout(() => {
        advanceTimeoutRef.current = null;
        setAdvancing(false);
        moveToQuestion(currentIndex + 1);
      }, 320);
    }
  };

  return (
    <div
      className="quiz-protected min-w-0 space-y-6"
      data-copy-deterrence="client-side"
      onCopy={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {autoSubmitted && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
        >
          {msg.session.autoSubmitted}
        </div>
      )}

      {integrityWarning && session.mode === SESSION_MODE.SIMULATION && (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
        >
          <span className="min-w-0 flex-1">{msg.session.integrityWarning}</span>
          <button
            type="button"
            onClick={() => setIntegrityWarning(false)}
            className="min-h-11 rounded-lg border border-amber-400 px-3 py-2 font-medium hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-amber-600 dark:hover:bg-amber-900/40"
          >
            {msg.session.dismissIntegrityWarning}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-text-secondary dark:text-text-dark-secondary">
          {msg.session.question} {currentIndex + 1} {msg.session.of} {questions.length}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {msg.session.mode}: {session.mode === SESSION_MODE.SIMULATION ? msg.session.simulationMode : msg.session.studyMode}
          </span>
          <div
            role="timer"
            aria-live="polite"
            aria-label={msg.session.timer}
            className={`tabular-nums whitespace-nowrap text-lg font-mono ${
              timerDisplay.startsWith("00:0") || timerDisplay.startsWith("00:1")
                ? "font-bold text-red-600 dark:text-red-400"
                : timerDisplay.startsWith("00:")
                  ? "font-semibold text-amber-600 dark:text-amber-400"
                  : ""
            }`}
          >
            {timerHidden
              ? session.mode === SESSION_MODE.SIMULATION
                ? msg.session.timerRunningHidden
                : msg.session.timerPaused
              : timerDisplay}
          </div>
          {timerHidden && (
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {session.mode === SESSION_MODE.SIMULATION ? msg.session.integrityIncidents : msg.session.timerHidden}
              {session.mode === SESSION_MODE.SIMULATION ? `: ${session.integrityIncidents.length}` : ""}
            </span>
          )}
        </div>
      </div>

      {session.config.isCustom && (
        <section
          className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-900/10"
          aria-labelledby="custom-session-summary"
        >
          <div>
            <h2 id="custom-session-summary" className="font-semibold">{msg.session.customExam}</h2>
            <p className="mt-1 text-sm text-text-secondary dark:text-text-dark-secondary">
              {msg.session.requestedDistribution}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {DOMAIN_ORDER.map((domain) => (
              <div key={domain} className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-surface px-3 py-2 text-sm dark:bg-surface-dark">
                <span className="min-w-0 break-words">{msg.session.domainLabels[domain]}</span>
                <span className="shrink-0 tabular-nums">
                  {session.config.domainWeights[domain]}% · {actualDomainCounts[domain]} {msg.session.actualQuestions}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {warnings.warned5 && !warnings.warned2 && (
        <div role="alert" className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {msg.session.warning5}
        </div>
      )}
      {warnings.warned2 && !warnings.warned1 && (
        <div role="alert" className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {msg.session.warning2}
        </div>
      )}
      {warnings.warned1 && (
        <div role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {msg.session.warning1}
        </div>
      )}

      {currentCopy.source === TRANSLATION_SOURCE.ENGLISH_FALLBACK && (
        <div
          role="note"
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"
        >
          {msg.session.englishFallback}
        </div>
      )}

      <QuestionCard
        question={currentQuestion}
        selectedOptions={currentAnswer?.selected ?? []}
        onSelect={handleOptionSelect}
        locale={localeValue}
        selectionLabel={currentQuestion.multiSelect ? msg.session.multiSelect : msg.session.singleSelect}
      />
      <p className="sr-only" aria-live="polite">
        {advancing ? msg.session.selectionTransition : ""}
      </p>

      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border dark:bg-border-dark">
          <div
            className="h-2 rounded-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={answeredCount}
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-label={`${answeredCount} of ${questions.length} answered`}
          />
        </div>
        <div className="mt-2 text-center text-xs text-text-secondary dark:text-text-dark-secondary">
          {answeredCount}/{questions.length} {msg.session.answered}
        </div>
      </div>

      <div className="sticky bottom-2 z-10 space-y-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur dark:border-border-dark dark:bg-surface-dark/95">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
          <button
            onClick={() => moveToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-dark-alt"
          >
            {msg.session.previous}
          </button>
          <button
            onClick={() => moveToQuestion(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:hover:bg-surface-dark-alt"
          >
            {msg.session.next}
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2" aria-label="Question navigation">
          {questions.map((question, index) => {
            const answered = session.answers.some(
              (answer) => answer.questionId === question.id && answer.selected.length > 0
            );
            return (
              <button
                key={question.id}
                onClick={() => moveToQuestion(index)}
                className={`min-h-11 min-w-11 rounded border px-2 text-xs transition-colors ${
                  index === currentIndex
                    ? "border-brand-500 bg-brand-50 font-bold dark:border-brand-600 dark:bg-brand-900/20"
                    : answered
                      ? "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
                      : "border-border hover:bg-surface-alt dark:border-border-dark dark:hover:bg-surface-dark-alt"
                }`}
                aria-label={`${msg.session.question} ${index + 1}`}
                aria-current={index === currentIndex ? "step" : undefined}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 text-center">
        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary">{msg.session.confirmSubmit}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => handleSubmit(false)}
                className="min-h-11 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                {msg.session.confirmYes}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded-lg border border-border px-6 py-2 text-sm font-medium transition-colors hover:bg-surface-alt dark:border-border-dark dark:hover:bg-surface-dark-alt"
              >
                {msg.session.confirmNo}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="min-h-11 rounded-lg bg-brand-600 px-8 py-3 font-medium text-white transition-colors hover:bg-brand-700"
          >
            {msg.session.submit}
          </button>
        )}
      </div>

      <Disclaimer text={DISCLAIMER_TEXT} />
    </div>
  );
}
