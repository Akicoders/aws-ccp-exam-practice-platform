"use client";

interface SessionLoadingProps {
  label: string;
}

export default function SessionLoading({ label }: SessionLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="space-y-6 py-8"
    >
      <p className="text-center text-sm text-text-secondary dark:text-text-dark-secondary">
        {label}
      </p>
      <div aria-hidden="true" className="animate-pulse space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-32 rounded bg-border dark:bg-border-dark" />
          <div className="h-6 w-16 rounded bg-border dark:bg-border-dark" />
        </div>
        <div className="h-20 w-full rounded-lg bg-border dark:bg-border-dark" />
        <div className="h-12 w-full rounded-lg bg-border dark:bg-border-dark" />
        <div className="h-12 w-full rounded-lg bg-border dark:bg-border-dark" />
        <div className="h-12 w-5/6 rounded-lg bg-border dark:bg-border-dark" />
      </div>
    </div>
  );
}
