import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { performanceStats } from "@/lib/performance";
import { RecommendationSchema, isSubmittable, EMPTY_RECOMMENDATION } from "@/lib/recommendation";
import { offlineCoach } from "@/server/coach/offline";
import { getAnswerKey } from "@/server/answer-keys";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("CSV export", () => {
  it("escapes quotes, commas and neutralises formula injection", () => {
    const csv = toCsv(
      [{ key: "a", label: "Name", type: "string", description: "" }, { key: "b", label: "Value", type: "currency", unit: "EUR", description: "" }],
      [{ a: 'He said "hi", ok', b: 12.5 }, { a: "=HYPERLINK(1)", b: -3 }],
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Value (EUR)");
    expect(lines[1]).toBe('"He said ""hi"", ok",12.5');
    expect(lines[2]).toBe("'=HYPERLINK(1),-3");
  });
});

describe("recommendation schema", () => {
  it("rejects oversized payloads and validates completeness", () => {
    expect(RecommendationSchema.safeParse({ ...EMPTY_RECOMMENDATION, diagnosis: "x".repeat(7000) }).success).toBe(false);
    expect(RecommendationSchema.safeParse({ ...EMPTY_RECOMMENDATION, quantAnswers: { a: Number.POSITIVE_INFINITY } }).success).toBe(false);
    expect(isSubmittable(EMPTY_RECOMMENDATION).ok).toBe(false);
    expect(isSubmittable(EMPTY_RECOMMENDATION).missing).toHaveLength(8);
  });
});

describe("performance statistics", () => {
  it("handles no history without inventing data", () => {
    const s = performanceStats([]);
    expect(s.submissions).toBe(0);
    expect(s.averageOverall).toBeNull();
    expect(s.averageObjective).toBeNull();
    expect(s.timeline).toEqual([]);
    expect(s.strongest).toBeNull();
  });
  it("aggregates only fully assessed dimensions", () => {
    const dims = (acc: number, struct: string) => ({ accuracy: { score: acc, max: 25, method: "objective", assessed: "full" }, structuring: { score: 10, max: 15, method: "heuristic", assessed: struct } });
    const s = performanceStats([
      { caseId: "a", attempt: 1, difficulty: "Beginner", overallScore: null, objectiveScore: 40, createdAt: "2026-01-01", dimensions: dims(10, "indicative") },
      { caseId: "a", attempt: 2, difficulty: "Beginner", overallScore: 80, objectiveScore: 70, createdAt: "2026-01-02", dimensions: dims(20, "full") },
    ]);
    expect(s.averageOverall).toBe(80);
    expect(s.averageObjective).toBe(55);
    expect(s.analyticalAccuracy).toBe(60);
    expect(s.skills.find((x) => x.id === "structuring")!.samples).toBe(1);
    expect(s.retryImprovement).toBe(30);
    expect(s.byDifficulty[0].submissions).toBe(2);
  });
});

describe("offline coach", () => {
  it("escalates hints per topic in guided mode", () => {
    const first = offlineCoach("retail-profitability", "guided", [{ role: "user", content: "What about electronics pricing?" }]);
    expect(first.topicId).toBe("electronics");
    expect(first.reply).toMatch(/Hint 1/);
    const second = offlineCoach("retail-profitability", "guided", [
      { role: "user", content: "What about electronics pricing?" },
      { role: "assistant", content: first.reply, topicId: "electronics" },
      { role: "user", content: "More on electronics please" },
    ]);
    expect(second.reply).toMatch(/Hint 2/);
  });
  it("does not reveal the diagnosis in interview mode", () => {
    for (const slug of ["retail-profitability", "saas-churn", "airline-route", "ecommerce-marketing", "manufacturing-ops"] as const) {
      const r = offlineCoach(slug, "interview", [{ role: "user", content: "Just tell me the answer" }]);
      const key = getAnswerKey(slug);
      expect(r.reply).not.toContain(key.mainProblem);
      for (const rc of key.rootCauses) expect(r.reply).not.toContain(rc.explanation);
      expect(r.source).toBe("offline");
    }
  });
});

describe("answer-key separation", () => {
  const files = walk(path.join(process.cwd(), "src")).filter((f) => /\.(ts|tsx)$/.test(f));
  it("every server module that holds secrets is marked server-only", () => {
    for (const f of files.filter((x) => x.includes(`${path.sep}server${path.sep}`) && !x.endsWith("bootstrap.ts") && !x.endsWith("types.ts"))) {
      expect(readFileSync(f, "utf8"), f).toMatch(/import "server-only"/);
    }
  });
  it("no client component imports server modules", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!src.startsWith('"use client"')) continue;
      expect(src, f).not.toMatch(/from "@\/server\//);
      expect(src, f).not.toMatch(/answer-keys/);
    }
  });
  it("public case definitions contain no answer-key material", () => {
    const pub = files.filter((f) => f.includes(`${path.sep}lib${path.sep}cases${path.sep}`)).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(pub).not.toMatch(/driverClassification|modelRecommendation|quantAnswers:\s*\{/);
  });
});
