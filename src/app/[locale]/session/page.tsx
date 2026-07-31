"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMessages } from "../locale-layout-client";
import QuestionCard from "@/components/question-card";
import Disclaimer from "@/components/disclaimer";
import SessionLoading from "@/components/session-loading";
import {
  type Locale,
  type NormalizedQuestion,
  type SessionState,
  type SessionPreset,
  type OptionLetter,
  SESSION_CONFIG,
  SESSION_STATUS,
  DISCLAIMER_TEXT,
} from "@/types/contracts";
import { loadQuestionPools } from "@/data/questions/index";
import { sampleSession, createSession, recordAnswer, scoreSession } from "@/lib/quiz-engine";
import { loadStore, saveStore, upsertSession, addResult, mergeDomainAnalytics } from "@/lib/browser-store";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
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

  const presetKey = (searchParams.get("preset") || "short").toUpperCase() as SessionPreset;
  const config = SESSION_CONFIG[presetKey] || SESSION_CONFIG.SHORT;

  const [session, setSession] = useState<SessionState | null>(null);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  // Timer state
  const [timerDisplay, setTimerDisplay] = useState(formatTime(config.durationMinutes * 60));
  const [timerHidden, setTimerHidden] = useState(false);
  const timerStarted = useRef(false);
  const startTime = useRef<number | null>(null);
  const visibleAccrued = useRef(0);
  const lastVisibleTick = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const warnings = useRef({ w5: false, w2: false, w1: false });
  const sessionRef = useRef<SessionState | null>(null);

  // Initialize session
  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const store = loadStore(locale as Locale, "light");
        const pools = await loadQuestionPools();
        if (!active) return;

        const { questions: sampled, warnings: sampWarnings } = sampleSession(
          { pools },
          presetKey
        );

        if (sampWarnings.some((w) => w.type === "unmet-quota")) {
          setError("Could not generate a valid session with unique questions. Try a shorter session.");
          setLoading(false);
          return;
        }

        const newSession = createSession(sampled, config);
        sessionRef.current = newSession;
        setSession(newSession);
        setQuestions(sampled);

        const updatedStore = upsertSession(store, newSession);
        saveStore(updatedStore);
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
  }, [config, locale, presetKey]);

  // Timer
  useEffect(() => {
    if (!session || loading) return;

    const tick = () => {
      if (!timerStarted.current) return;
      const now = Date.now();

      // Wall-clock 2x cap
      const wallMs = now - startTime.current!;
      if (wallMs >= config.durationMinutes * 60 * 1000 * 2) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          handleSubmit(true);
        }
        return;
      }

      // Visible elapsed
      let visibleMs = visibleAccrued.current;
      if (!document.hidden) {
        visibleMs += now - (lastVisibleTick.current || now);
      }
      lastVisibleTick.current = document.hidden ? lastVisibleTick.current : now;

      const remainingSec = Math.max(0, Math.ceil((config.durationMinutes * 60 * 1000 - visibleMs) / 1000));
      setTimerDisplay(formatTime(remainingSec));

      if (remainingSec <= 300 && !warnings.current.w5) {
        warnings.current.w5 = true;
      }
      if (remainingSec <= 120 && !warnings.current.w2) {
        warnings.current.w2 = true;
      }
      if (remainingSec <= 60 && !warnings.current.w1) {
        warnings.current.w1 = true;
      }
      if (remainingSec <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        handleSubmit(true);
      }
    };

    const handleVisibility = () => {
      setTimerHidden(document.hidden);
      if (document.hidden && startTime.current) {
        const now = Date.now();
        visibleAccrued.current += now - (lastVisibleTick.current || now);
        lastVisibleTick.current = null;
      } else if (!document.hidden) {
        lastVisibleTick.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(tick, 250);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session, loading]);

  const handleFirstAnswer = useCallback(() => {
    if (!timerStarted.current) {
      timerStarted.current = true;
      startTime.current = Date.now();
      lastVisibleTick.current = Date.now();
    }
  }, []);

  const handleAnswer = useCallback(
    (questionId: string, selected: OptionLetter[]) => {
      if (!sessionRef.current) return;
      handleFirstAnswer();

      const updated = recordAnswer(sessionRef.current, questionId, selected);
      sessionRef.current = updated;
      setSession(updated);

      // Persist
      try {
        const store = loadStore(locale as any, "light");
        const updatedStore = upsertSession(store, updated);
        saveStore(updatedStore);
      } catch {}
    },
    [locale, handleFirstAnswer]
  );

  const handleSubmit = useCallback(
    (isAutoSubmit = false) => {
      if (!sessionRef.current || questions.length === 0) return;
      if (isAutoSubmit) setAutoSubmitted(true);

      const { result, domainAnalytics } = scoreSession(sessionRef.current, questions);
      try {
        const store = loadStore(locale as any, "light");
        const mergedAnalytics = mergeDomainAnalytics(store.analytics, domainAnalytics);
        const updatedStore = addResult(
          { ...store, analytics: mergedAnalytics },
          result
        );
        saveStore(updatedStore);
      } catch {}

      router.push(`/${locale}/results?sessionId=${result.sessionId}`);
    },
    [questions, locale, router]
  );

  const [confirming, setConfirming] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (loading) {
    return <SessionLoading label={msg.common.loading} />;
  }

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white text-sm font-medium hover:bg-brand-700"
        >
          Go to Home
        </button>
      </div>
    );
  }

  if (!session || questions.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-text-secondary dark:text-text-dark-secondary">
          {msg.session.missingSession}
        </p>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white text-sm font-medium hover:bg-brand-700"
        >
          {msg.session.goHome}
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = session.answers.find((a) => a.questionId === currentQuestion.id);
  const answeredCount = session.answers.length;
  const allAnswered = answeredCount === questions.length;

  const handleOptionSelect = (option: OptionLetter) => {
    if (!currentAnswer) {
      handleAnswer(currentQuestion.id, [option]);
    } else {
      const current = currentAnswer.selected;
      let updated: OptionLetter[];
      if (currentQuestion.multiSelect) {
        updated = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
      } else {
        updated = [option];
      }
      handleAnswer(currentQuestion.id, updated);
    }
  };

  return (
    <div className="space-y-6">
      {autoSubmitted && (
        <div
          role="alert"
          className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          {msg.session.autoSubmitted}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm text-text-secondary dark:text-text-dark-secondary">
          {msg.session.question} {currentIndex + 1} {msg.session.of} {questions.length}
        </div>
        <div className="flex items-center gap-4">
          <div
            role="timer"
            aria-live="polite"
            aria-label="Time remaining"
            className={`text-lg font-mono ${
              timerDisplay.startsWith("00:0") || timerDisplay.startsWith("00:1")
                ? "text-red-600 dark:text-red-400 font-bold"
                : timerDisplay.startsWith("00:")
                  ? "text-amber-600 dark:text-amber-400"
                  : ""
            }`}
          >
            {timerHidden ? "⏸" : timerDisplay}
          </div>
          {timerHidden && (
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {msg.session.timerHidden}
            </span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {warnings.current.w5 && !warnings.current.w2 && (
        <div role="alert" className="text-sm text-amber-600 dark:text-amber-400 font-medium">
          {msg.session.warning5}
        </div>
      )}
      {warnings.current.w2 && !warnings.current.w1 && (
        <div role="alert" className="text-sm text-amber-600 dark:text-amber-400 font-medium">
          {msg.session.warning2}
        </div>
      )}
      {warnings.current.w1 && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400 font-medium">
          {msg.session.warning1}
        </div>
      )}

      {/* Question */}
      <QuestionCard
        question={currentQuestion}
        selectedOptions={currentAnswer?.selected ?? []}
        onSelect={handleOptionSelect}
        selectionLabel={
          currentQuestion.multiSelect
            ? msg.session.multiSelect
            : msg.session.singleSelect
        }
      />

      {/* Progress bar */}
      <div className="w-full bg-border dark:bg-border-dark rounded-full h-2">
        <div
          className="bg-brand-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={questions.length}
        />
      </div>
      <div className="text-xs text-text-secondary dark:text-text-dark-secondary text-center">
        {answeredCount}/{questions.length} answered
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-border dark:border-border-dark disabled:opacity-40 hover:bg-surface-alt dark:hover:bg-surface-dark-alt transition-colors"
        >
          ← Previous
        </button>

        <div className="flex gap-1 flex-wrap justify-center max-w-xs">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 text-xs rounded border transition-colors ${
                i === currentIndex
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-600 font-bold"
                  : session.answers.find((a) => a.questionId === q.id)
                    ? "border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600"
                    : "border-border dark:border-border-dark hover:bg-surface-alt dark:hover:bg-surface-dark-alt"
              }`}
              aria-label={`Go to question ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={currentIndex === questions.length - 1}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-border dark:border-border-dark disabled:opacity-40 hover:bg-surface-alt dark:hover:bg-surface-dark-alt transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Submit */}
      <div className="text-center pt-4">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
              {msg.session.confirmSubmit}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleSubmit(false)}
                className="rounded-lg bg-brand-600 px-6 py-2 text-white text-sm font-medium hover:bg-brand-700"
              >
                {msg.session.confirmYes}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-border dark:border-border-dark px-6 py-2 text-sm font-medium hover:bg-surface-alt dark:hover:bg-surface-dark-alt"
              >
                {msg.session.confirmNo}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-brand-600 px-8 py-3 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            {msg.session.submit}
          </button>
        )}
      </div>

      <Disclaimer text={DISCLAIMER_TEXT} />
    </div>
  );
}
