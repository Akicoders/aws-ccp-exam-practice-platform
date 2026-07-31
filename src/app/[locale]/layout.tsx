import { Suspense } from "react";
import type { Locale } from "@/types/contracts";
import LocaleLayoutClient from "./locale-layout-client";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "es" }];
}

function LocaleLayoutFallback() {
  return (
    <div className="flex min-h-screen flex-col">
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-6"
      >
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading page"
          className="text-sm text-text-secondary dark:text-text-dark-secondary"
        >
          Loading...
        </div>
      </main>
    </div>
  );
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <LocaleLayoutClient params={params}>{children}</LocaleLayoutClient>
    </Suspense>
  );
}
