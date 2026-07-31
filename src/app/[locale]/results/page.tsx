"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMessages } from "../locale-layout-client";
import QuestionCard from "@/components/question-card";
import Disclaimer from "@/components/disclaimer";
import SessionLoading from "@/components/session-loading";
import {
  type Domain,
  type Locale,
  type NormalizedQuestion,
  type SessionResult,
  DOMAIN_LABELS,
  DOMAIN_ORDER,
  DISCLAIMER_TEXT,
  EXPLANATION_UNAVAILABLE,
  LOCALE,
  SESSION_MODE,
  TRANSLATION_SOURCE,
} from "@/types/contracts";
import { loadStore } from "@/lib/browser-store";
import { loadQuestionPools } from "@/data/questions/index";
import { getQuestionCopy } from "@/data/questions/translations";
import explanations from "@/data/explanations.json";

interface ExplanationEntry {
  questionId: string;
  domain: string;
  explanation: string;
}

interface DomainStat {
  domain: Domain;
  correct: number;
  total: number;
  accuracy: number;
}

function formatTimeSpent(timeSpentMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timeSpentMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function ResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const msg = useMessages(locale);
  const localeValue = locale as Locale;
  const [result, setResult] = useState<SessionResult | null>(null);
  const [questionMap, setQuestionMap] = useState<Map<string, NormalizedQuestion> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadResults = async () => {
      try {
        const sessionId = searchParams.get("sessionId");
        if (!sessionId) {
          setLoading(false);
          return;
        }

        const store = loadStore(localeValue, "light");
        const found = store.results.find((candidate) => candidate.sessionId === sessionId);
        if (!found) {
          setLoading(false);
          return;
        }

        const pools = await loadQuestionPools();
        if (!active) return;
        const questions = new Map<string, NormalizedQuestion>();
        for (const pool of pools) {
          for (const question of pool.questions) questions.set(question.id, question);
        }
        setQuestionMap(questions);
        setResult(found);
        setLoading(false);
      } catch {
        if (!active) return;
        setLoading(false);
      }
    };

    void loadResults();
    return () => {
      active = false;
    };
  }, [localeValue, searchParams]);

  if (loading) {
    return <SessionLoading label={msg.common.loading} />;
  }

  if (!result || !questionMap) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-text-secondary dark:text-text-dark-secondary">No results found for this session.</p>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {msg.session.goHome}
        </button>
      </div>
    );
  }

  const explanationMap = new Map<string, ExplanationEntry>();
  for (const entry of explanations as ExplanationEntry[]) explanationMap.set(entry.questionId, entry);

  const domainStats: DomainStat[] = DOMAIN_ORDER.map((domain) => {
    const answers = result.answers.filter((answer) => questionMap.get(answer.questionId)?.domain === domain);
    const correct = answers.filter((answer) => answer.isCorrect).length;
    const total = answers.length;
    return {
      domain,
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  }).filter((stat) => stat.total > 0);

  const weakestDomain = [...domainStats].sort((left, right) => left.accuracy - right.accuracy)[0];
  const passColor = result.passed
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
  const timeSpent = result.timeSpentMs > 0
    ? formatTimeSpent(result.timeSpentMs)
    : msg.results.notRecorded;
  const modeLabel = result.mode === SESSION_MODE.SIMULATION
    ? msg.results.simulationMode
    : msg.results.studyMode;
  const hasEnglishFallback = localeValue === LOCALE.ES && result.answers.some((answer) => {
    const question = questionMap.get(answer.questionId);
    return question && getQuestionCopy(question, localeValue).source === TRANSLATION_SOURCE.ENGLISH_FALLBACK;
  });

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-3 text-center">
        <h1 className="text-balance text-3xl font-bold">{msg.results.title}</h1>
        <div className={`text-5xl font-bold tabular-nums ${passColor}`}>{Math.round(result.percentage)}%</div>
        <p className={`text-lg font-semibold ${passColor}`} role="status" aria-live="polite">
          {result.passed ? msg.results.passed : msg.results.failed}
          <span className="ml-2 text-sm font-normal text-text-secondary dark:text-text-dark-secondary">
            ({msg.results.passThreshold})
          </span>
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={msg.results.title}>
        <div className="min-w-0 rounded-xl border border-border p-4 dark:border-border-dark">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">
            {msg.results.correct}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {result.correctCount}/{result.totalQuestions}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-border p-4 dark:border-border-dark">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">
            {msg.results.timeSpent}
          </p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums">{timeSpent}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-border p-4 dark:border-border-dark">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">
            {msg.results.rawPoints}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{result.rawPoints}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-border p-4 dark:border-border-dark">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">
            {msg.results.mode}
          </p>
          <p className="mt-1 break-words text-lg font-semibold">{modeLabel}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-border p-4 dark:border-border-dark">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">
            {msg.results.integrityIncidents}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{result.integrityIncidentCount}</p>
          <p className="mt-1 text-xs text-text-secondary dark:text-text-dark-secondary">
            {result.integrityIncidentCount === 0 ? msg.results.integrityIncidentNone : msg.results.integrityIncidentNote}
          </p>
        </div>
      </section>

      {hasEnglishFallback && (
        <div
          role="note"
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"
        >
          {msg.session.englishFallback}
        </div>
      )}

      <section className="rounded-xl border border-border p-4 dark:border-border-dark sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">{msg.results.domainBreakdown}</h2>
            <p className="mt-1 text-sm text-text-secondary dark:text-text-dark-secondary">
              {msg.results.correct}: {result.correctCount}/{result.totalQuestions}
            </p>
          </div>
          {weakestDomain && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {msg.results.priorityArea}: {DOMAIN_LABELS[weakestDomain.domain]}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {domainStats.map((stat) => (
            <div key={stat.domain} className="min-w-0 rounded-lg bg-surface-alt p-3 dark:bg-surface-dark-alt">
              <div className="flex min-w-0 justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">{DOMAIN_LABELS[stat.domain]}</span>
                <span className="shrink-0 tabular-nums">{stat.correct}/{stat.total} ({stat.accuracy}%)</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-border dark:bg-border-dark">
                <div
                  className={`h-2 rounded-full ${
                    stat.accuracy >= 70
                      ? "bg-green-500"
                      : stat.accuracy >= 40
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${stat.accuracy}%` }}
                  role="progressbar"
                  aria-valuenow={stat.accuracy}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${DOMAIN_LABELS[stat.domain]} ${stat.accuracy}%`}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20 sm:p-5">
        <h2 className="font-semibold text-amber-950 dark:text-amber-100">{msg.results.nextStep}</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-200">
          {result.passed ? msg.results.nextStepPass : msg.results.nextStepFail}
        </p>
      </section>

      <section aria-labelledby="answer-review-title" className="space-y-3">
        <div>
          <h2 id="answer-review-title" className="font-semibold">{msg.results.reviewTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary dark:text-text-dark-secondary">{msg.results.reviewIntro}</p>
        </div>
        <div className="space-y-2">
          {result.answers.map((answer, index) => {
            const question = questionMap.get(answer.questionId);
            if (!question) return null;
            const explanation = explanationMap.get(answer.questionId)?.explanation ?? EXPLANATION_UNAVAILABLE;
            const selected = answer.selected.length > 0
              ? answer.selected.join(", ")
              : msg.results.unanswered;
            const statusLabel = answer.isCorrect ? msg.results.correct : msg.results.incorrect;
            return (
              <details key={answer.questionId} className="group overflow-hidden rounded-xl border border-border dark:border-border-dark">
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 p-4 font-medium marker:hidden group-open:bg-surface-alt dark:group-open:bg-surface-dark-alt">
                  <span className="shrink-0">{msg.results.questionNumber} {index + 1}</span>
                  <span className={answer.isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                    {statusLabel}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-sm font-normal text-text-secondary dark:text-text-dark-secondary">
                    {question.questionText}
                  </span>
                </summary>
                <div className="space-y-4 border-t border-border p-4 dark:border-border-dark">
                  <QuestionCard
                    question={question}
                    selectedOptions={answer.selected}
                    locale={localeValue}
                    selectionLabel={question.multiSelect ? msg.session.multiSelect : msg.session.singleSelect}
                    showResult
                    isCorrect={answer.isCorrect}
                    correctAnswers={answer.correctAnswers}
                    correctLabel={msg.results.correctStatus}
                    incorrectLabel={msg.results.incorrect}
                  />
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <p className="min-w-0 break-words">
                      <span className="font-medium">{msg.results.yourAnswer}:</span> {selected}
                    </p>
                    <p className="min-w-0 break-words">
                      <span className="font-medium">{msg.results.correctAnswer}:</span> {answer.correctAnswers.join(", ")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-alt p-4 dark:bg-surface-dark-alt">
                    <h3 className="text-sm font-semibold">{msg.results.explanation}</h3>
                    <p className="mt-2 break-words text-sm leading-6 text-text-secondary dark:text-text-dark-secondary">
                      {explanation}
                    </p>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap justify-center gap-3 no-print">
        <button
          onClick={() => window.print()}
          className="min-h-11 rounded-lg border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-surface-alt dark:border-border-dark dark:hover:bg-surface-dark-alt"
        >
          {msg.results.print}
        </button>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="min-h-11 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {msg.session.goHome}
        </button>
      </div>

      <section className="print-only space-y-3">
        <h2 className="text-xl font-bold">{msg.results.summaryPrint}</h2>
        <p>{msg.results.score}: {Math.round(result.percentage)}% ({result.passed ? msg.results.passed : msg.results.failed})</p>
        <p>{msg.results.correct}: {result.correctCount}/{result.totalQuestions}</p>
        <p>{msg.results.timeSpent}: {timeSpent}</p>
        <h3 className="mt-4 font-bold">{msg.results.reviewTitle}</h3>
        {result.answers.map((answer, index) => {
          const question = questionMap.get(answer.questionId);
          if (!question) return null;
          const explanation = explanationMap.get(answer.questionId)?.explanation ?? EXPLANATION_UNAVAILABLE;
          return (
            <div key={answer.questionId} className="break-inside-avoid border-b border-black pb-3">
              <p><strong>{msg.results.questionNumber} {index + 1}:</strong> {question.questionText}</p>
              <p>{msg.results.yourAnswer}: {answer.selected.length ? answer.selected.join(", ") : msg.results.unanswered}</p>
              <p>{msg.results.correctAnswer}: {answer.correctAnswers.join(", ")}</p>
              <p>{msg.results.explanation}: {explanation}</p>
            </div>
          );
        })}
        <Disclaimer text={DISCLAIMER_TEXT} className="mt-3" />
      </section>

      <Disclaimer text={DISCLAIMER_TEXT} />
    </div>
  );
}
