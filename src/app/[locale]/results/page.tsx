"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMessages } from "../locale-layout-client";
import QuestionCard from "@/components/question-card";
import Disclaimer from "@/components/disclaimer";
import SessionLoading from "@/components/session-loading";
import {
  type SessionResult,
  type NormalizedQuestion,
  type DomainPool,
  type DomainAnalytics,
  DISCLAIMER_TEXT,
  EXPLANATION_UNAVAILABLE,
  DOMAIN_ORDER,
  DOMAIN_LABELS,
} from "@/types/contracts";
import { loadStore } from "@/lib/browser-store";
import { loadQuestionPools } from "@/data/questions/index";
import explanations from "@/data/explanations.json";

type ExplanationEntry = {
  questionId: string;
  domain: string;
  explanation: string;
};

export default function ResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const msg = useMessages(locale);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [analytics, setAnalytics] = useState<DomainAnalytics[]>([]);
  const [questionPools, setQuestionPools] = useState<DomainPool[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadResults = async () => {
      try {
        const sessionId = searchParams.get("sessionId");
        if (!sessionId) {
          setLoading(false);
          return;
        }

        const store = loadStore(locale as any, "light");
        const found = store.results.find((r) => r.sessionId === sessionId);
        if (found) {
          const pools = await loadQuestionPools();
          if (!active) return;
          setQuestionPools(pools);
          setResult(found);
        }
        if (!active) return;
        setAnalytics(store.analytics);
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
  }, [locale, searchParams]);

  if (loading) {
    return <SessionLoading label={msg.common.loading} />;
  }

  if (!result) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-text-secondary dark:text-text-dark-secondary">
          No results found for this session.
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

  // Build question lookup
  const questionMap = new Map<string, NormalizedQuestion>();
  if (!questionPools) {
    return <div>{msg.common.error}</div>;
  }
  for (const pool of questionPools) {
    for (const q of pool.questions) {
      questionMap.set(q.id, q);
    }
  }

  const explanationMap = new Map<string, ExplanationEntry>();
  for (const entry of explanations as ExplanationEntry[]) {
    explanationMap.set(entry.questionId, entry);
  }

  const getExplanation = (questionId: string): string => {
    const entry = explanationMap.get(questionId);
    return entry?.explanation ?? EXPLANATION_UNAVAILABLE;
  };

  const passColor = result.passed
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  if (reviewIndex !== null) {
    const answer = result.answers[reviewIndex];
    const question = questionMap.get(answer.questionId);
    if (!question) {
      return <div>Question not found.</div>;
    }

    return (
      <div className="space-y-6">
        <button
          onClick={() => setReviewIndex(null)}
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          ← Back to results
        </button>

          <QuestionCard
            question={question}
            selectedOptions={answer.selected}
            selectionLabel={
              question.multiSelect
                ? msg.session.multiSelect
                : msg.session.singleSelect
            }
            showResult
          isCorrect={answer.isCorrect}
          correctAnswers={answer.correctAnswers}
        />

        <div className="rounded-lg border border-border dark:border-border-dark p-4">
          <h3 className="font-medium text-sm mb-2">{msg.results.explanation}</h3>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {getExplanation(answer.questionId)}
          </p>
        </div>

        <Disclaimer text={DISCLAIMER_TEXT} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{msg.results.title}</h1>
        <div className={`text-5xl font-bold ${passColor}`}>
          {Math.round(result.percentage)}%
        </div>
        <div className="text-lg">
          <span className={passColor}>
            {result.passed ? msg.results.passed : msg.results.failed}
          </span>
          <span className="text-text-secondary dark:text-text-dark-secondary ml-2">
            ({msg.results.passThreshold})
          </span>
        </div>
        <div className="text-sm text-text-secondary dark:text-text-dark-secondary">
          {msg.results.rawPoints}: {result.rawPoints}/{result.totalQuestions} |{" "}
          {msg.results.correct}: {result.correctCount}/{result.totalQuestions}
        </div>
      </div>

      {/* Domain Breakdown */}
      <div className="rounded-xl border border-border dark:border-border-dark p-4">
        <h2 className="font-semibold mb-4">{msg.results.domainBreakdown}</h2>
        <div className="space-y-3">
          {result.answers.map((answer) => {
            const q = questionMap.get(answer.questionId);
            const domain = q?.domain;
            if (!domain) return null;
            return null; // We aggregate below
          })}

          {/* Aggregate domain stats */}
          {(() => {
            const domainStats: Record<string, { correct: number; total: number }> = {};
            for (const answer of result.answers) {
              const q = questionMap.get(answer.questionId);
              const domain = q?.domain;
              if (!domain) continue;
              if (!domainStats[domain]) {
                domainStats[domain] = { correct: 0, total: 0 };
              }
              domainStats[domain].total += 1;
              if (answer.isCorrect) domainStats[domain].correct += 1;
            }

            return DOMAIN_ORDER.map((domain) => {
              const stats = domainStats[domain];
              if (!stats) return null;
              const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
              return (
                <div key={domain}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{DOMAIN_LABELS[domain]}</span>
                    <span>
                      {stats.correct}/{stats.total} ({accuracy}%)
                    </span>
                  </div>
                  <div className="w-full bg-border dark:bg-border-dark rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        accuracy >= 70
                          ? "bg-green-500"
                          : accuracy >= 40
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Weak Areas */}
      <div className="rounded-xl border border-border dark:border-border-dark p-4">
        <h2 className="font-semibold mb-2">{msg.results.weakAreas}</h2>
        {analytics.length === 0 ? (
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {msg.results.weakAreaIntro}
          </p>
        ) : (
          <div className="space-y-3">
            {analytics.map((a) => {
              const accuracy = a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0;
              return (
                <div key={a.domain}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{DOMAIN_LABELS[a.domain as keyof typeof DOMAIN_LABELS] || a.domain}</span>
                    <span>
                      {a.correct}/{a.total} ({accuracy}%)
                    </span>
                  </div>
                  <div className="w-full bg-border dark:bg-border-dark rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        accuracy >= 70
                          ? "bg-green-500"
                          : accuracy >= 40
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review answers */}
      <div className="text-center">
        <button
          onClick={() => setReviewIndex(0)}
          className="rounded-lg bg-brand-600 px-6 py-2 text-white text-sm font-medium hover:bg-brand-700"
        >
          {msg.results.review} ({result.totalQuestions} questions)
        </button>
      </div>

      {/* Summary for printing */}
      <div className="rounded-xl border border-border dark:border-border-dark p-4">
        <h2 className="font-semibold mb-2">{msg.results.summaryPrint}</h2>
        <div className="text-sm space-y-1 text-text-secondary dark:text-text-dark-secondary">
          <p>
            {msg.results.score}: {Math.round(result.percentage)}% ({result.passed ? "Passed" : "Failed"})
          </p>
          <p>
            {msg.results.correct}: {result.correctCount}/{result.totalQuestions}
          </p>
          <p>
            {msg.results.percentage}: {Math.round(result.percentage)}%
          </p>
          <Disclaimer text={DISCLAIMER_TEXT} className="mt-2" />
          <button
            onClick={() => window.print()}
            className="mt-2 rounded-lg border border-border dark:border-border-dark px-4 py-1 text-xs font-medium hover:bg-surface-alt dark:hover:bg-surface-dark-alt no-print"
          >
            {msg.results.print}
          </button>
        </div>
      </div>

      <Disclaimer text={DISCLAIMER_TEXT} />
    </div>
  );
}
