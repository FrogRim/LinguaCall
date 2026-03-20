import { describe, it, expect } from "vitest";
import { buildInstructions } from "../services/openaiRealtime";

const base = {
  sessionId: "sess-1",
  callId: "call-1",
  clerkUserId: "user-1",
  durationMinutes: 10
};

describe("buildInstructions — AI 시스템 프롬프트 분기", () => {
  describe("EN / OPIC (영어)", () => {
    const instr = buildInstructions({
      ...base,
      language: "en",
      exam: "opic",
      level: "IM3",
      topic: "daily conversation"
    });

    it("영어로 응답", () => {
      expect(instr).toMatch(/You are LinguaCall/);
    });
    it("OPIC 언급", () => {
      expect(instr).toMatch(/OPIC/);
    });
    it("topic 포함", () => {
      expect(instr).toMatch(/daily conversation/);
    });
    it("level 포함", () => {
      expect(instr).toMatch(/IM3/);
    });
    it("durationMinutes 포함", () => {
      expect(instr).toMatch(/10 minutes/);
    });
  });

  describe("DE / Goethe B2 (독일어) — 핵심", () => {
    const instr = buildInstructions({
      ...base,
      language: "de",
      exam: "goethe_b2",
      level: "B1",
      topic: "Studium und Beruf"
    });

    it("독일어 지시문 사용 (Du bist)", () => {
      expect(instr).toMatch(/Du bist LinguaCall/);
    });
    it("Goethe B2 명시", () => {
      expect(instr).toMatch(/Goethe.+B2/);
    });
    it("Sprechen 파트 명시", () => {
      expect(instr).toMatch(/Sprechen/);
    });
    it("단독 발화 + 대화 구조 언급", () => {
      expect(instr).toMatch(/Monologisches Sprechen/);
      expect(instr).toMatch(/Dialogisches Sprechen/);
    });
    it("오류 교정 명시", () => {
      expect(instr).toMatch(/Korrigiere/);
    });
    it("topic 포함 (독일어 주제)", () => {
      expect(instr).toMatch(/Studium und Beruf/);
    });
    it("level 포함", () => {
      expect(instr).toMatch(/B1/);
    });
    it("durationMinutes 포함", () => {
      expect(instr).toMatch(/10 Minuten/);
    });
    it("평가 항목 포함 (Aussprache/Grammatik/Wortschatz/Flüssigkeit)", () => {
      expect(instr).toMatch(/Aussprache/);
      expect(instr).toMatch(/Grammatik/);
      expect(instr).toMatch(/Wortschatz/);
      expect(instr).toMatch(/Fl.+igkeit/);
    });

    it("레벨별 시나리오 — A2 (초급)", () => {
      const i = buildInstructions({ ...base, language: "de", exam: "goethe_b2", level: "A2", topic: "Reisen" });
      expect(i).toMatch(/A2/);
      expect(i).toMatch(/Reisen/);
    });

    it("레벨별 시나리오 — B2 (목표 레벨)", () => {
      const i = buildInstructions({ ...base, language: "de", exam: "goethe_b2", level: "B2", topic: "Umwelt und Natur" });
      expect(i).toMatch(/B2/);
    });
  });

  describe("ZH / HSK5 (중국어)", () => {
    const instr = buildInstructions({
      ...base,
      language: "zh",
      exam: "hsk5",
      level: "HSK4",
      topic: "工作与职业"
    });

    it("중국어 지시문", () => {
      expect(instr).toMatch(/你是LinguaCall/);
    });
    it("HSK 5급 언급", () => {
      expect(instr).toMatch(/HSK 5/);
    });
    it("topic 포함", () => {
      expect(instr).toMatch(/工作与职业/);
    });
    it("보통화(普通话) 명시", () => {
      expect(instr).toMatch(/普通话/);
    });
  });

  describe("ES / DELE B1 (스페인어)", () => {
    const instr = buildInstructions({
      ...base,
      language: "es",
      exam: "dele_b1",
      level: "A2",
      topic: "vida cotidiana"
    });

    it("스페인어 지시문", () => {
      expect(instr).toMatch(/Eres LinguaCall/);
    });
    it("DELE B1 언급", () => {
      expect(instr).toMatch(/DELE B1/);
    });
    it("topic 포함", () => {
      expect(instr).toMatch(/vida cotidiana/);
    });
  });

  describe("JA / JLPT N2 (일본어)", () => {
    const instr = buildInstructions({
      ...base,
      language: "ja",
      exam: "jlpt_n2",
      level: "N3",
      topic: "仕事と日常生活"
    });

    it("일본어 지시문 사용", () => {
      expect(instr).toMatch(/LinguaCall/);
    });
    it("JLPT N2 언급", () => {
      expect(instr).toMatch(/JLPT N2/);
    });
    it("topic 포함", () => {
      expect(instr).toMatch(/仕事と日常生活/);
    });
    it("level 포함", () => {
      expect(instr).toMatch(/N3/);
    });
  });

  describe("FR / DELF B1 (프랑스어)", () => {
    const instr = buildInstructions({
      ...base,
      language: "fr",
      exam: "delf_b1",
      level: "A2",
      topic: "vie quotidienne"
    });

    it("프랑스어 지시문 사용", () => {
      expect(instr).toMatch(/LinguaCall/);
    });
    it("DELF B1 언급", () => {
      expect(instr).toMatch(/DELF B1/);
    });
    it("topic 포함", () => {
      expect(instr).toMatch(/vie quotidienne/);
    });
  });

  describe("폴백 — 알 수 없는 언어/시험", () => {
    it("미지원 언어는 영어 기본 프롬프트로 폴백", () => {
      const instr = buildInstructions({
        ...base,
        language: "ko",
        exam: "topik",
        level: "3",
        topic: "일상생활"
      });
      expect(instr).toMatch(/You are LinguaCall/);
    });
  });
});
