/**
 * Build-time normalization script.
 * Parses master_questions_final.csv, normalizes/deduplicates, validates,
 * preserves all usable fields, warns about missing options, and generates
 * four domain pools + metadata index.
 *
 * Usage: node --loader ts-node/esm scripts/normalize.ts
 */

import fs from "fs";
import path from "path";
import Papa from "papaparse";
import {
  type NormalizedQuestion,
  type DomainPool,
  type PoolIndex,
  type OptionLetter,
  type Domain,
  CSV_DOMAIN_MAP,
  DOMAIN,
  DOMAIN_ORDER,
  OPTION_LETTER,
} from "../src/types/contracts.js";

const CSV_PATH = path.resolve("master_questions_final.csv");
const OUT_DIR = path.resolve("src/data/questions");

const OPTION_KEYS = ["optionA", "optionB", "optionC", "optionD", "optionE", "optionF"] as const;

/**
 * Normalize text for dedup key:
 * - Unicode NFD (compatibility decomposition)
 * - Lowercase
 * - Remove punctuation (replace with space)
 * - Collapse whitespace
 * - Trim
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace punctuation with space
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

function parseOptionLetter(val: string): OptionLetter | null {
  const v = val.trim().toUpperCase();
  if (v in OPTION_LETTER) return v as OptionLetter;
  return null;
}

function parseCorrectAnswers(val: string): OptionLetter[] {
  if (!val || val.trim() === "") return [];
  return val
    .split(",")
    .map((v) => parseOptionLetter(v))
    .filter((x): x is OptionLetter => x !== null);
}

function parseMultiSelect(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function parseTimes(val: string): number {
  const n = parseInt(val.trim(), 10);
  return isNaN(n) ? 1 : n;
}

function parseDomain(val: string): Domain | null {
  const cleaned = val.trim().replace(/^"/, "").replace(/"$/, "");
  return CSV_DOMAIN_MAP[cleaned] ?? null;
}

interface RawRow {
  id: string;
  question: string;
  multiSelect: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  optionF: string;
  correctAnswers: string;
  times: string;
  domain: string;
}

function main(): void {
  console.log(`Reading ${CSV_PATH}...`);
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");

  const parsed = Papa.parse<RawRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    console.warn(`Parse errors: ${parsed.errors.length}`);
    for (const e of parsed.errors.slice(0, 5)) {
      console.warn(`  Row ${e.row}: ${e.message}`);
    }
  }

  console.log(`Parsed ${parsed.data.length} rows.`);

  // Step 1: Normalize and dedup
  const dedupMap = new Map<string, NormalizedQuestion>();
  const warnings: string[] = [];
  let skippedNoDomain = 0;
  let skippedNoCorrect = 0;

  for (const row of parsed.data) {
    const domain = parseDomain(row.domain);
    if (!domain) {
      skippedNoDomain++;
      continue;
    }

    const correctAnswers = parseCorrectAnswers(row.correctAnswers);
    if (correctAnswers.length === 0) {
      skippedNoCorrect++;
      continue;
    }

    const questionText = (row.question || "").trim();
    if (!questionText) continue;

    const normKey = normalizeText(questionText);

    // Check for missing options (A-D are the main options; E/F optional)
    const MAIN_OPTIONS = ["optionA", "optionB", "optionC", "optionD"] as const;
    for (const key of MAIN_OPTIONS) {
      const val = (row[key] || "").trim();
      if (!val) {
        warnings.push(
          `Question ${row.id}: ${key} is empty — using placeholder`
        );
      }
    }

    const newQ: NormalizedQuestion = {
      id: row.id.trim(),
      questionText,
      multiSelect: parseMultiSelect(row.multiSelect),
      optionA: (row.optionA || "").trim() || "(Option not available)",
      optionB: (row.optionB || "").trim() || "(Option not available)",
      optionC: (row.optionC || "").trim() || "(Option not available)",
      optionD: (row.optionD || "").trim() || "(Option not available)",
      optionE: (row.optionE || "").trim() || "",
      optionF: (row.optionF || "").trim() || "",
      correctAnswers,
      times: parseTimes(row.times),
      domain,
    };

    const existing = dedupMap.get(normKey);
    if (existing) {
      // Keep the one with highest times
      if (newQ.times > existing.times) {
        dedupMap.set(normKey, newQ);
      }
    } else {
      dedupMap.set(normKey, newQ);
    }
  }

  const questions = Array.from(dedupMap.values());
  console.log(`After dedup: ${questions.length} unique questions.`);
  console.log(`Skipped (no domain): ${skippedNoDomain}`);
  console.log(`Skipped (no correct answers): ${skippedNoCorrect}`);

  if (warnings.length > 0) {
    console.warn(`\nOption warnings (${warnings.length}):`);
    for (const w of warnings.slice(0, 10)) {
      console.warn(`  ${w}`);
    }
    if (warnings.length > 10) {
      console.warn(`  ... and ${warnings.length - 10} more`);
    }
  }

  // Step 2: Build domain pools
  const pools: DomainPool[] = [];
  const totals: Record<Domain, number> = {} as Record<Domain, number>;
  let grandTotal = 0;

  for (const domain of DOMAIN_ORDER) {
    const poolQuestions = questions.filter((q) => q.domain === domain);
    pools.push({ domain, questions: poolQuestions });
    totals[domain] = poolQuestions.length;
    grandTotal += poolQuestions.length;
  }

  console.log("\nDomain pools:");
  for (const pool of pools) {
    console.log(`  ${pool.domain}: ${pool.questions.length}`);
  }
  console.log(`  TOTAL: ${grandTotal}`);

  // Step 3: Write output files
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const pool of pools) {
    const filePath = path.join(OUT_DIR, `${pool.domain.toLowerCase()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(pool.questions, null, 2));
    console.log(`  Wrote ${filePath}`);
  }

  const index: PoolIndex = {
    pools: pools.map((p) => ({
      domain: p.domain,
      questions: [], // Don't duplicate questions in index
    })),
    generatedAt: new Date().toISOString(),
    totals,
    grandTotal,
  };

  // Write a separate metadata file
  const metaPath = path.join(OUT_DIR, "index.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        totals,
        grandTotal,
        generatedAt: index.generatedAt,
        presets: {
          "10q/10m": { questionCount: 10, durationMinutes: 10 },
          "20q/20m": { questionCount: 20, durationMinutes: 20 },
          "50q/60m": { questionCount: 50, durationMinutes: 60 },
        },
      },
      null,
      2
    )
  );
  console.log(`  Wrote ${metaPath}`);

  // Write a combined index for easy app loading
  const loadPath = path.join(OUT_DIR, "index.ts");
  const loadContent = `// Auto-generated by normalize.ts — do not edit
// Generated at: ${index.generatedAt}

import type { DomainPool, PoolIndex } from "@/types/contracts";

import cloudConcepts from "./cloud_concepts.json";
import security from "./security.json";
import technologyServices from "./technology_services.json";
import billingPricing from "./billing_pricing.json";

export const questionPools: DomainPool[] = [
  { domain: "CLOUD_CONCEPTS", questions: cloudConcepts },
  { domain: "SECURITY", questions: security },
  { domain: "TECHNOLOGY_SERVICES", questions: technologyServices },
  { domain: "BILLING_PRICING", questions: billingPricing },
];

export const poolIndex: PoolIndex = {
  pools: [
    { domain: "CLOUD_CONCEPTS", questions: [] },
    { domain: "SECURITY", questions: [] },
    { domain: "TECHNOLOGY_SERVICES", questions: [] },
    { domain: "BILLING_PRICING", questions: [] },
  ],
  generatedAt: "${index.generatedAt}",
  totals: ${JSON.stringify(totals)},
  grandTotal: ${grandTotal},
};
`;
  fs.writeFileSync(loadPath, loadContent);
  console.log(`  Wrote ${loadPath}`);

  console.log("\nDone! Normalization complete.");
}

main();
