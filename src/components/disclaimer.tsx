interface DisclaimerProps {
  text: string;
  className?: string;
}

export default function Disclaimer({ text, className = "" }: DisclaimerProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 ${className}`}
    >
      {text}
    </div>
  );
}
