"use client";

import {
  type Locale,
  type NormalizedQuestion,
  type OptionLetter,
  LOCALE,
} from "@/types/contracts";
import { getQuestionCopy, getQuestionOptionText } from "@/data/questions/translations";

const OPTIONS = [
  "A" as OptionLetter,
  "B" as OptionLetter,
  "C" as OptionLetter,
  "D" as OptionLetter,
  "E" as OptionLetter,
  "F" as OptionLetter,
];

interface QuestionCardProps {
  question: NormalizedQuestion;
  selectedOptions: OptionLetter[];
  onSelect?: (option: OptionLetter) => void;
  selectionLabel?: string;
  showResult?: boolean;
  isCorrect?: boolean;
  correctAnswers?: OptionLetter[];
  locale?: Locale;
  correctLabel?: string;
  incorrectLabel?: string;
}

export default function QuestionCard({
  question,
  selectedOptions,
  onSelect,
  selectionLabel,
  showResult = false,
  isCorrect,
  correctAnswers,
  locale = LOCALE.EN,
  correctLabel = "Correct",
  incorrectLabel = "Incorrect",
}: QuestionCardProps) {
  const copy = getQuestionCopy(question, locale);
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

  const contentLang = copy.source === "reviewed-spanish" ? "es" : "en";

  return (
    <fieldset className="space-y-4 min-w-0">
      <legend lang={contentLang} className="mb-2 text-base font-medium text-pretty break-words">
        {copy.questionText}
      </legend>
      <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-3">
        {label}
        {showResult && isCorrect !== undefined && (
          <span className={`ml-2 font-medium ${isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {isCorrect ? `✓ ${correctLabel}` : `✗ ${incorrectLabel}`}
          </span>
        )}
      </p>

      <div className="space-y-2">
         {OPTIONS.map((key) => {
           const optionText = getQuestionOptionText(question, copy, key);
           if (!optionText) return null; // Skip empty options

          return (
            <label
              key={key}
              className={`flex min-h-11 items-start gap-3 rounded-lg border p-3 cursor-pointer touch-manipulation transition-colors ${getOptionStyle(key)} ${showResult ? "cursor-default" : ""}`}
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
              <div lang={contentLang} className="min-w-0 flex-1 break-words text-sm">
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
