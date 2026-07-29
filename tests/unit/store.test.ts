import { describe, it, expect, beforeEach } from "vitest";
import {
  loadStore,
  saveStore,
  upsertSession,
  addResult,
  mergeDomainAnalytics,
} from "@/lib/browser-store";
import type { BrowserStore, SessionState, SessionResult, DomainAnalytics, Domain } from "@/types/contracts";
import { SESSION_STATUS, DOMAIN, SESSION_CONFIG, STORAGE_KEY } from "@/types/contracts";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, val: string) => { storage.set(key, val); },
      removeItem: (key: string) => { storage.delete(key); },
    },
    configurable: true,
    writable: true,
  });
});

describe("loadStore", () => {
  it("returns default store when localStorage is empty", () => {
    const s = loadStore("en", "light");
    expect(s.locale).toBe("en");
    expect(s.theme).toBe("light");
    expect(s.sessions).toEqual([]);
    expect(s.results).toEqual([]);
  });

  it("returns saved store", () => {
    const saved: BrowserStore = {
      activeSessionId: "s1",
      sessions: [],
      results: [],
      analytics: [],
      locale: "es",
      theme: "dark",
    };
    saveStore(saved);
    const loaded = loadStore("en", "light");
    expect(loaded.locale).toBe("es");
    expect(loaded.theme).toBe("dark");
  });

  it("filters malformed records and falls back to safe preferences", () => {
    const validSession: SessionState = {
      id: "s1",
      questionIds: ["q1"],
      answers: [],
      currentIndex: 0,
      config: SESSION_CONFIG.SHORT,
      startTime: null,
      status: SESSION_STATUS.ACTIVE,
    };
    const validResult: SessionResult = {
      sessionId: "s1",
      rawPoints: 1,
      correctCount: 1,
      totalQuestions: 1,
      percentage: 100,
      passed: true,
      answers: [],
      completedAt: 100,
      preset: "SHORT",
    };
    const validAnalytics: DomainAnalytics = {
      domain: DOMAIN.CLOUD_CONCEPTS,
      correct: 1,
      total: 1,
      timestamp: 100,
    };

    storage.set(
      STORAGE_KEY,
      JSON.stringify({
        activeSessionId: "s1",
        sessions: [null, "not a session", { id: "incomplete" }, validSession],
        results: [null, 42, { sessionId: "incomplete" }, validResult],
        analytics: [null, "not analytics", { domain: "UNKNOWN" }, validAnalytics],
        locale: "fr",
        theme: "neon",
      })
    );

    const loaded = loadStore("en", "light");

    expect(loaded.sessions).toEqual([validSession]);
    expect(loaded.results).toEqual([validResult]);
    expect(loaded.analytics).toEqual([validAnalytics]);
    expect(loaded.activeSessionId).toBe("s1");
    expect(loaded.locale).toBe("en");
    expect(loaded.theme).toBe("light");
  });

  it("recovers without throwing from malformed nested records", () => {
    storage.set(
      STORAGE_KEY,
      JSON.stringify({
        activeSessionId: { value: "s1" },
        sessions: [
          {
            id: "s1",
            questionIds: ["q1"],
            answers: [null],
            currentIndex: 0,
            config: SESSION_CONFIG.SHORT,
            startTime: null,
            status: SESSION_STATUS.ACTIVE,
          },
        ],
        results: [
          {
            sessionId: "s1",
            rawPoints: 1,
            correctCount: 1,
            totalQuestions: 1,
            percentage: 100,
            passed: true,
            answers: [{ questionId: "q1", selected: ["invalid"] }],
            completedAt: 100,
            preset: "SHORT",
          },
        ],
        analytics: [{ domain: DOMAIN.CLOUD_CONCEPTS, correct: 2, total: 1, timestamp: 100 }],
        locale: "en",
        theme: "dark",
      })
    );

    expect(() => loadStore("en", "light")).not.toThrow();
    expect(loadStore("en", "light")).toMatchObject({
      activeSessionId: null,
      sessions: [],
      results: [],
      analytics: [],
      locale: "en",
      theme: "dark",
    });
  });
});

describe("upsertSession", () => {
  it("adds a new session", () => {
    const store: BrowserStore = {
      activeSessionId: null,
      sessions: [],
      results: [],
      analytics: [],
      locale: "en" as any,
      theme: "light" as any,
    };
    const session: SessionState = {
      id: "s1",
      questionIds: ["q1"],
      answers: [],
      currentIndex: 0,
      config: SESSION_CONFIG.SHORT,
      startTime: null,
      status: SESSION_STATUS.ACTIVE,
    };
    const updated = upsertSession(store, session);
    expect(updated.sessions.length).toBe(1);
    expect(updated.activeSessionId).toBe("s1");
  });

  it("updates existing session", () => {
    const session: SessionState = {
      id: "s1",
      questionIds: ["q1"],
      answers: [],
      currentIndex: 0,
      config: SESSION_CONFIG.SHORT,
      startTime: null,
      status: SESSION_STATUS.ACTIVE,
    };
    let store: BrowserStore = {
      activeSessionId: "s1",
      sessions: [session],
      results: [],
      analytics: [],
      locale: "en" as any,
      theme: "light" as any,
    };
    const updated = upsertSession(store, { ...session, currentIndex: 5 });
    expect(updated.sessions.length).toBe(1);
    expect(updated.sessions[0].currentIndex).toBe(5);
  });
});

describe("addResult", () => {
  it("adds result and clears active session", () => {
    const session: SessionState = {
      id: "s1",
      questionIds: [],
      answers: [],
      currentIndex: 0,
      config: SESSION_CONFIG.SHORT,
      startTime: null,
      status: SESSION_STATUS.ACTIVE,
    };
    let store: BrowserStore = {
      activeSessionId: "s1",
      sessions: [session],
      results: [],
      analytics: [],
      locale: "en" as any,
      theme: "light" as any,
    };
    const result: SessionResult = {
      sessionId: "s1",
      rawPoints: 8,
      correctCount: 8,
      totalQuestions: 10,
      percentage: 80,
      passed: true,
      answers: [],
      completedAt: Date.now(),
      preset: "SHORT",
    };
    const updated = addResult(store, result);
    expect(updated.results.length).toBe(1);
    expect(updated.activeSessionId).toBeNull();
  });
});

describe("mergeDomainAnalytics", () => {
  it("combines analytics for same domain", () => {
    const existing: DomainAnalytics[] = [
      { domain: DOMAIN.CLOUD_CONCEPTS, correct: 5, total: 10, timestamp: 100 },
    ];
    const incoming: DomainAnalytics[] = [
      { domain: DOMAIN.CLOUD_CONCEPTS, correct: 3, total: 5, timestamp: 200 },
    ];
    const merged = mergeDomainAnalytics(existing, incoming);
    expect(merged.length).toBe(1);
    const cc = merged.find((a) => a.domain === DOMAIN.CLOUD_CONCEPTS)!;
    expect(cc.correct).toBe(8);
    expect(cc.total).toBe(15);
  });
});
