import { describe, it, expect } from "vitest";
import { ALLOWED_LANGUAGE_EXAM_PAIRS } from "../config/languageExam";

const isAllowed = (language: string, exam: string) =>
  (ALLOWED_LANGUAGE_EXAM_PAIRS[language] ?? []).includes(exam);

describe("Language / Exam pair validation", () => {
  describe("허용되는 조합", () => {
    it("EN + OPIC 허용", () => {
      expect(isAllowed("en", "opic")).toBe(true);
    });
    it("DE + Goethe B2 허용", () => {
      expect(isAllowed("de", "goethe_b2")).toBe(true);
    });
    it("ZH + HSK5 허용", () => {
      expect(isAllowed("zh", "hsk5")).toBe(true);
    });
    it("ES + DELE B1 허용", () => {
      expect(isAllowed("es", "dele_b1")).toBe(true);
    });
    it("JA + JLPT N2 허용", () => {
      expect(isAllowed("ja", "jlpt_n2")).toBe(true);
    });
    it("FR + DELF B1 허용", () => {
      expect(isAllowed("fr", "delf_b1")).toBe(true);
    });
  });

  describe("차단되는 조합", () => {
    it("EN + goethe_b2 차단 (언어/시험 불일치)", () => {
      expect(isAllowed("en", "goethe_b2")).toBe(false);
    });
    it("DE + opic 차단 (언어/시험 불일치)", () => {
      expect(isAllowed("de", "opic")).toBe(false);
    });
    it("ZH + dele_b1 차단", () => {
      expect(isAllowed("zh", "dele_b1")).toBe(false);
    });
    it("JA + opic 차단 (언어/시험 불일치)", () => {
      expect(isAllowed("ja", "opic")).toBe(false);
    });
    it("FR + goethe_b2 차단 (언어/시험 불일치)", () => {
      expect(isAllowed("fr", "goethe_b2")).toBe(false);
    });
    it("존재하지 않는 언어 차단", () => {
      expect(isAllowed("ko", "topik")).toBe(false);
    });
    it("빈 문자열 차단", () => {
      expect(isAllowed("", "")).toBe(false);
    });
  });
});
