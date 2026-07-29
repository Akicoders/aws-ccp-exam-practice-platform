"use client";

import { use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "./locale-layout-client";
import {
  SESSION_CONFIG,
  type SessionPreset,
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

  const startSession = useCallback(
    (preset: SessionPreset) => {
      const key = preset.toLowerCase();
      router.push(`/${locale}/session?preset=${key}`);
    },
    [locale, router]
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

      <h2 className="text-xl font-semibold text-center">
        {msg.home.selectPreset}
      </h2>

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
