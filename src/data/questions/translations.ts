import {
  type Locale,
  type NormalizedQuestion,
  type OptionLetter,
  type QuestionCopy,
  type QuestionTranslation,
  LOCALE,
  TRANSLATION_SOURCE,
} from "@/types/contracts";
import { poolIndex } from "./index";

/**
 * Reviewed Spanish content belongs here, keyed by the generated question id.
 * The empty map is intentional: the source CSV currently contains English only.
 */
export const REVIEWED_SPANISH_TRANSLATIONS: Record<string, QuestionTranslation> = {};

const OPTION_FIELDS: Record<OptionLetter, keyof Pick<
  NormalizedQuestion,
  "optionA" | "optionB" | "optionC" | "optionD" | "optionE" | "optionF"
>> = {
  A: "optionA",
  B: "optionB",
  C: "optionC",
  D: "optionD",
  E: "optionE",
  F: "optionF",
};

export function getQuestionCopy(
  question: NormalizedQuestion,
  locale: Locale
): QuestionCopy {
  if (locale === LOCALE.ES) {
    const translation = REVIEWED_SPANISH_TRANSLATIONS[question.id];
    if (translation) {
      return {
        questionText: translation.questionText,
        options: translation.options,
        source: TRANSLATION_SOURCE.REVIEWED_SPANISH,
      };
    }

    return {
      questionText: question.questionText,
      options: {},
      source: TRANSLATION_SOURCE.ENGLISH_FALLBACK,
    };
  }

  return {
    questionText: question.questionText,
    options: {},
    source: TRANSLATION_SOURCE.ENGLISH_SOURCE,
  };
}

export function getQuestionOptionText(
  question: NormalizedQuestion,
  copy: QuestionCopy,
  option: OptionLetter
): string {
  return copy.options[option] ?? question[OPTION_FIELDS[option]];
}

export function getSpanishTranslationCoverage(): {
  translatedQuestions: number;
  totalQuestions: number;
  percentage: number;
} {
  const translatedQuestions = Object.keys(REVIEWED_SPANISH_TRANSLATIONS).length;
  const totalQuestions = poolIndex.grandTotal;
  return {
    translatedQuestions,
    totalQuestions,
    percentage: totalQuestions > 0
      ? (translatedQuestions / totalQuestions) * 100
      : 0,
  };
}
