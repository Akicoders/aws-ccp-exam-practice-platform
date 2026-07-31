import { describe, expect, it } from "vitest";
import { getQuestionCopy, getQuestionOptionText, getSpanishTranslationCoverage } from "@/data/questions/translations";
import { TRANSLATION_SOURCE } from "@/types/contracts";
import type { NormalizedQuestion } from "@/types/contracts";

const question: NormalizedQuestion = {
  id: "q1",
  questionText: "Which service provides object storage?",
  multiSelect: false,
  optionA: "Amazon S3",
  optionB: "Amazon EC2",
  optionC: "Amazon RDS",
  optionD: "Amazon VPC",
  optionE: "",
  optionF: "",
  correctAnswers: ["A"],
  times: 1,
  domain: "CLOUD_CONCEPTS",
};

describe("question translation boundary", () => {
  it("marks missing Spanish copy as an explicit English fallback", () => {
    const copy = getQuestionCopy(question, "es");

    expect(copy.source).toBe(TRANSLATION_SOURCE.ENGLISH_FALLBACK);
    expect(copy.questionText).toBe(question.questionText);
    expect(getQuestionOptionText(question, copy, "A")).toBe(question.optionA);
  });

  it("reports the current reviewed coverage from generated question metadata", () => {
    expect(getSpanishTranslationCoverage()).toEqual({
      translatedQuestions: 0,
      totalQuestions: 11447,
      percentage: 0,
    });
  });
});
