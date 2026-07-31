"use client";

import { type NormalizedQuestion, type OptionLetter, OPTION_LETTER } from "@/types/contracts";

const OPTIONS = [
  { key: "A" as OptionLetter, field: "optionA" as const },
  { key: "B" as OptionLetter, field: "optionB" as const },
  { key: "C" as OptionLetter, field: "optionC" as const },
  { key: "D" as OptionLetter, field: "optionD" as const },
  { key: "E" as OptionLetter, field: "optionE" as const },
  { key: "F" as OptionLetter, field: "optionF" as const },
];

interface QuestionCardProps {
  question: NormalizedQuestion;
  selectedOptions: OptionLetter[];
  onSelect?: (option: OptionLetter) => void;
  selectionLabel?: string;
  showResult?: boolean;
  isCorrect?: boolean;
  correctAnswers?: OptionLetter[];
}

export default function QuestionCard({
  question,
  selectedOptions,
  onSelect,
  selectionLabel,
  showResult = false,
  isCorrect,
  correctAnswers,
}: QuestionCardProps) {
  const handleSelect = (option: OptionLetter) => {
    if (showResult || !onSelect) return;
    onSelect(option);
  };

  const getOptionStyle = (option: OptionLetter) => {
    const isSelected = selectedOptions.includes(option);

    if (showResult) {
      const isCorrectAnswer = correctAnswers?.includes(option) ?? false;
      if (isCorrectAnswer && isSelected) return "border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600";
      if (isCorrectAnswer) return "border-green-500 bg-green-50/50 dark:bg-green-900/10 dark:border-green-600";
      if (isSelected && !isCorrectAnswer) return "border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600";
      return "border-border dark:border-border-dark opacity-70";
    }

    if (isSelected) return "border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-600";
    return "border-border dark:border-border-dark hover:border-brand-300 dark:hover:border-brand-700 hover:bg-surface-alt dark:hover:bg-surface-dark-alt";
  };

  const label =
    selectionLabel ??
    (question.multiSelect ? "Select all that apply" : "Select one answer");

  return (
    <fieldset className="space-y-4">
      <legend lang="en" className="text-base font-medium mb-2">
        {question.questionText}
      </legend>
      <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-3">
        {label}
        {showResult && isCorrect !== undefined && (
          <span className={`ml-2 font-medium ${isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {isCorrect ? "✓ Correct" : "✗ Incorrect"}
          </span>
        )}
      </p>

      <div className="space-y-2">
        {OPTIONS.map(({ key, field }) => {
          const optionText = question[field];
          if (!optionText) return null; // Skip empty options

          return (
            <label
              key={key}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${getOptionStyle(key)} ${showResult ? "cursor-default" : ""}`}
            >
              <input
                type={question.multiSelect ? "checkbox" : "radio"}
                name={`q-${question.id}`}
                value={key}
                checked={selectedOptions.includes(key)}
                onChange={() => handleSelect(key)}
                disabled={showResult}
                className="mt-0.5"
                aria-label={`Option ${key}: ${optionText}`}
              />
              <div className="flex-1 text-sm">
                <span className="font-medium mr-2">{key}.</span>
                {optionText}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
