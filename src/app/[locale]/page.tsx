"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "./locale-layout-client";
import {
  SESSION_CONFIG,
  SESSION_MODE,
  type SessionPreset,
  type SessionMode,
  DOMAIN_TARGETS,
  DISCLAIMER_TEXT,
} from "@/types/contracts";
import Disclaimer from "@/components/disclaimer";

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

  const startSession = useCallback(
    (preset: SessionPreset) => {
      const key = preset.toLowerCase();
      router.push(`/${locale}/session?preset=${key}&mode=${mode}`);
    },
    [locale, mode, router]
  );

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
          const descKey =
            key === "SHORT"
              ? "shortDesc"
              : key === "MEDIUM"
                ? "mediumDesc"
                : "fullDesc";
          return (
            <button
              key={key}
              onClick={() => startSession(key)}
              className="rounded-xl border border-border dark:border-border-dark p-6 text-left hover:border-brand-500 hover:shadow-md transition-all bg-surface-alt dark:bg-surface-dark-alt"
            >
              <h3 className="font-semibold text-lg mb-1">{config.label}</h3>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                {msg.home[descKey as keyof typeof msg.home]}
              </p>
            </button>
          );
        })}
      </div>

      <Disclaimer text={DISCLAIMER_TEXT} />
    </div>
  );
}
