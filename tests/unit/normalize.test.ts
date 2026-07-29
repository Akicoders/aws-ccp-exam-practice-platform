import { describe, it, expect } from "vitest";
import {
  DOMAIN,
  CSV_DOMAIN_MAP,
  type Domain,
} from "@/types/contracts";

describe("CSV Domain Mapping", () => {
  it("maps all four CSV domain names to internal keys", () => {
    expect(CSV_DOMAIN_MAP["Cloud Concepts"]).toBe(DOMAIN.CLOUD_CONCEPTS);
    expect(CSV_DOMAIN_MAP["Security and Compliance"]).toBe(DOMAIN.SECURITY);
    expect(CSV_DOMAIN_MAP["Cloud Technology and Services"]).toBe(DOMAIN.TECHNOLOGY_SERVICES);
    expect(CSV_DOMAIN_MAP["Billing, Pricing, and Support"]).toBe(DOMAIN.BILLING_PRICING);
  });
});

describe("Question Pools", () => {
  it("generated data files exist with expected pools", async () => {
    const index = await import("@/data/questions/index");
    expect(index.questionPools).toBeDefined();
    expect(index.questionPools.length).toBe(4);

    const poolDomains = index.questionPools.map((p: any) => p.domain);
    expect(poolDomains).toContain(DOMAIN.CLOUD_CONCEPTS);
    expect(poolDomains).toContain(DOMAIN.SECURITY);
    expect(poolDomains).toContain(DOMAIN.TECHNOLOGY_SERVICES);
    expect(poolDomains).toContain(DOMAIN.BILLING_PRICING);
  });

  it("pool totals are numbers", async () => {
    const index = await import("@/data/questions/index");
    expect(index.poolIndex).toBeDefined();
    expect(typeof index.poolIndex.grandTotal).toBe("number");
    expect(index.poolIndex.grandTotal).toBeGreaterThan(0);

    const domains = Object.keys(index.poolIndex.totals);
    expect(domains.length).toBe(4);
    for (const count of Object.values(index.poolIndex.totals)) {
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    }
  });

  it("questions have correct fields", async () => {
    const index = await import("@/data/questions/index");
    const pool = index.questionPools[0];
    const q = pool.questions[0];
    expect(q).toBeDefined();
    expect(q.id).toBeDefined();
    expect(q.questionText).toBeDefined();
    expect(typeof q.multiSelect).toBe("boolean");
    expect(q.optionA).toBeDefined();
    expect(q.optionB).toBeDefined();
    expect(q.correctAnswers).toBeDefined();
    expect(q.domain).toBeDefined();
  });
});

describe("Explanations", () => {
  it("loads explanations file with entries", async () => {
    const explanations = await import("@/data/explanations.json");
    expect(explanations.default).toBeDefined();
    expect(Array.isArray(explanations.default)).toBe(true);
    expect(explanations.default.length).toBeGreaterThanOrEqual(200);
    expect(explanations.default.length).toBeLessThanOrEqual(300);
  });

  it("each explanation has questionId, domain, and explanation", async () => {
    const explanations = (await import("@/data/explanations.json")).default;
    for (const entry of explanations) {
      expect(entry.questionId).toBeDefined();
      expect(typeof entry.questionId).toBe("string");
      expect(entry.domain).toBeDefined();
      expect(entry.explanation).toBeDefined();
      expect(typeof entry.explanation).toBe("string");
    }
  });
});
