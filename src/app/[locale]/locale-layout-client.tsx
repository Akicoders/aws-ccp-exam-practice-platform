"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadStore, saveStore } from "@/lib/browser-store";
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
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const store = loadStore(locale as any, theme);
      setThemeState(store.theme);
      document.documentElement.classList.toggle("dark", store.theme === "dark");
      setMounted(true);
    } catch {
      setMounted(true);
    }
  }, [locale]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        const store = loadStore(locale as any, next);
        store.theme = next;
        saveStore(store);
      } catch {}
      return next;
    });
  }, [locale]);

  const msg = useMessages(locale);
  const otherLocale = locale === "en" ? "es" : "en";

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-text-secondary dark:text-text-dark-secondary">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border dark:border-border-dark bg-surface-alt dark:bg-surface-dark-alt no-print">
        <nav
          className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3"
          aria-label="Main navigation"
        >
          <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-3">
            <Link
              href={`/${otherLocale}${pathname.replace(/^\/(en|es)/, "") || "/"}`}
              className="text-xs font-medium px-2 py-1 rounded border border-border dark:border-border-dark hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              aria-label={msg.common.localeSwitch}
            >
              {otherLocale === "en" ? "EN" : "ES"}
            </Link>
            <button
              onClick={toggleTheme}
              className="text-sm px-2 py-1 rounded border border-border dark:border-border-dark hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
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
