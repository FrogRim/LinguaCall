import { describe, it, expect } from "vitest";
import { z } from "zod";

// sessions.ts의 CreateSessionSchema와 동일
const CreateSessionSchema = z.object({
  language: z.enum(["en", "de", "zh", "es"]),
  exam: z.enum(["opic", "goethe_b2", "hsk5", "dele_b1"]),
  level: z.string().min(1),
  topic: z.string().min(1),
  durationMinutes: z.number().int().min(1),
  contactMode: z.enum(["immediate", "scheduled_once"]),
  timezone: z.string().optional(),
  scheduledForAtUtc: z.string().optional()
}).refine(
  (data) => data.contactMode !== "scheduled_once" || !!data.scheduledForAtUtc,
  { message: "scheduledForAtUtc is required for scheduled_once", path: ["scheduledForAtUtc"] }
);

const validBase = {
  language: "en" as const,
  exam: "opic" as const,
  level: "IM3",
  topic: "daily conversation",
  durationMinutes: 10,
  contactMode: "immediate" as const
};

describe("CreateSession Zod schema", () => {
  describe("EN / OPIC — 기본 케이스", () => {
    it("유효한 즉시 세션 통과", () => {
      expect(CreateSessionSchema.safeParse(validBase).success).toBe(true);
    });

    it("scheduled_once + scheduledForAtUtc 있으면 통과", () => {
      const result = CreateSessionSchema.safeParse({
        ...validBase,
        contactMode: "scheduled_once",
        scheduledForAtUtc: "2026-06-01T10:00:00.000Z",
        timezone: "Asia/Seoul"
      });
      expect(result.success).toBe(true);
    });

    it("scheduled_once인데 scheduledForAtUtc 없으면 422", () => {
      const result = CreateSessionSchema.safeParse({
        ...validBase,
        contactMode: "scheduled_once"
      });
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe(
        "scheduledForAtUtc is required for scheduled_once"
      );
    });
  });

  describe("DE / Goethe B2 — 독일어 세션", () => {
    const deBase = {
      language: "de" as const,
      exam: "goethe_b2" as const,
      level: "B1",
      topic: "Studium und Beruf",
      durationMinutes: 10,
      contactMode: "immediate" as const
    };

    it("DE + goethe_b2 통과", () => {
      expect(CreateSessionSchema.safeParse(deBase).success).toBe(true);
    });

    it("DE + goethe_b2, 다양한 레벨 통과 (A2/B1/B2)", () => {
      for (const level of ["A2", "B1", "B2"]) {
        expect(CreateSessionSchema.safeParse({ ...deBase, level }).success).toBe(true);
      }
    });

    it("DE + goethe_b2, 다양한 주제 통과", () => {
      const topics = [
        "Studium und Beruf",
        "Gesellschaft und Kultur",
        "Umwelt und Natur",
        "Gesundheit"
      ];
      for (const topic of topics) {
        expect(CreateSessionSchema.safeParse({ ...deBase, topic }).success).toBe(true);
      }
    });

    it("DE + opic 조합 — exam enum 자체는 통과 (실제 차단은 store에서)", () => {
      // Zod는 값의 범위만 검증하고, 언어-시험 쌍 매칭은 inMemoryStore에서 검증
      const result = CreateSessionSchema.safeParse({ ...deBase, exam: "opic" });
      expect(result.success).toBe(true); // Zod 통과, store에서 422 예정
    });
  });

  describe("ZH / HSK5 세션", () => {
    it("ZH + hsk5 통과", () => {
      expect(CreateSessionSchema.safeParse({
        language: "zh",
        exam: "hsk5",
        level: "HSK4",
        topic: "工作与职业",
        durationMinutes: 10,
        contactMode: "immediate"
      }).success).toBe(true);
    });
  });

  describe("ES / DELE B1 세션", () => {
    it("ES + dele_b1 통과", () => {
      expect(CreateSessionSchema.safeParse({
        language: "es",
        exam: "dele_b1",
        level: "A2",
        topic: "vida cotidiana",
        durationMinutes: 10,
        contactMode: "immediate"
      }).success).toBe(true);
    });
  });

  describe("공통 유효성 실패 케이스", () => {
    it("지원하지 않는 언어 코드 거부 (JA)", () => {
      const result = CreateSessionSchema.safeParse({ ...validBase, language: "ja" });
      expect(result.success).toBe(false);
    });

    it("지원하지 않는 exam 거부 (jlpt_n2)", () => {
      const result = CreateSessionSchema.safeParse({ ...validBase, exam: "jlpt_n2" });
      expect(result.success).toBe(false);
    });

    it("level 빈 문자열 거부", () => {
      const result = CreateSessionSchema.safeParse({ ...validBase, level: "" });
      expect(result.success).toBe(false);
    });

    it("topic 빈 문자열 거부", () => {
      const result = CreateSessionSchema.safeParse({ ...validBase, topic: "" });
      expect(result.success).toBe(false);
    });

    it("durationMinutes 0 거부", () => {
      const result = CreateSessionSchema.safeParse({ ...validBase, durationMinutes: 0 });
      expect(result.success).toBe(false);
    });

    it("durationMinutes 소수 거부", () => {
      const result = CreateSessionSchema.safeParse({ ...validBase, durationMinutes: 10.5 });
      expect(result.success).toBe(false);
    });
  });
});
