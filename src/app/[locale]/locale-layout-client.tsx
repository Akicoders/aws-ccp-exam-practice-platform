"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { loadStore, saveStore } from "@/lib/browser-store";
import type { Locale } from "@/types/contracts";
import messagesEn from "@/../messages/en.json";
import messagesEs from "@/../messages/es.json";

type Messages = typeof messagesEn;

const messagesMap: Record<string, Messages> = {
  en: messagesEn,
  es: messagesEs,
};

export function useMessages(locale: string): Messages {
  return messagesMap[locale] || messagesEn;
}

export default function LocaleLayoutClient({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const store = loadStore(locale as Locale, theme);
      setThemeState(store.theme);
      document.documentElement.classList.toggle("dark", store.theme === "dark");
    } catch {
      document.documentElement.classList.remove("dark");
    }
  }, [locale]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        const store = loadStore(locale as Locale, next);
        store.theme = next;
        saveStore(store);
      } catch {}
      return next;
    });
  }, [locale]);

  const msg = useMessages(locale);
  const otherLocale = locale === "en" ? "es" : "en";
  const routePath = pathname.replace(/^\/(en|es)/, "") || "/";
  const query = searchParams.toString();
  const localeHref = `/${otherLocale}${routePath}${query ? `?${query}` : ""}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border dark:border-border-dark bg-surface-alt dark:bg-surface-dark-alt no-print">
        <nav
          className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
          aria-label="Main navigation"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={`/${locale}`}
              className="text-sm font-medium hover:text-brand-600 transition-colors"
            >
              {msg.common.home}
            </Link>
            <Link
              href={`/${locale}/resources`}
              className="text-sm font-medium hover:text-brand-600 transition-colors"
            >
              {msg.common.resources}
            </Link>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <a
              href="https://github.com/Akicoders/aws-ccp-exam-practice-platform"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-border transition-colors hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-border-dark dark:hover:bg-brand-900/20 dark:focus-visible:ring-offset-surface-dark-alt"
              aria-label={msg.common.githubLink}
              title={msg.common.githubLink}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.59 2 12.26c0 4.535 2.865 8.385 6.839 9.747.5.096.682-.222.682-.493 0-.244-.009-.891-.014-1.75-2.782.62-3.369-1.374-3.369-1.374-.455-1.188-1.11-1.504-1.11-1.504-.908-.637.069-.624.069-.624 1.004.073 1.533 1.057 1.533 1.057.892 1.568 2.341 1.116 2.912.854.091-.665.349-1.116.635-1.373-2.22-.26-4.555-1.14-4.555-5.076 0-1.122.39-2.038 1.03-2.757-.103-.261-.446-1.307.098-2.722 0 0 .84-.276 2.75 1.053A9.33 9.33 0 0 1 12 6.9a9.32 9.32 0 0 1 2.505.35c1.91-1.329 2.748-1.053 2.748-1.053.546 1.415.203 2.461.1 2.722.64.719 1.028 1.635 1.028 2.757 0 3.946-2.339 4.813-4.566 5.068.359.319.678.948.678 1.91 0 1.379-.012 2.49-.012 2.828 0 .274.18.594.688.493A10.27 10.27 0 0 0 22 12.26C22 6.59 17.523 2 12 2Z"
                />
              </svg>
            </a>
            <Link
              href={localeHref}
              className="min-h-11 min-w-11 rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-brand-50 dark:border-border-dark dark:hover:bg-brand-900/20"
              aria-label={msg.common.localeSwitch}
            >
              {otherLocale === "en" ? "EN" : "ES"}
            </Link>
            <button
              onClick={toggleTheme}
              className="min-h-11 min-w-11 rounded border border-border px-2 py-1 text-sm transition-colors hover:bg-brand-50 dark:border-border-dark dark:hover:bg-brand-900/20"
              aria-label={msg.common.themeToggle}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </nav>
      </header>
      <main id="main-content" className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-border dark:border-border-dark py-4 text-center text-xs text-text-secondary dark:text-text-dark-secondary no-print">
        {msg.common.footer}
      </footer>
    </div>
  );
}
