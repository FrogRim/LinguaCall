import { describe, expect, it } from "vitest";
import { buildInstructions } from "../services/openaiRealtime";

const base = {
  sessionId: "sess-1",
  callId: "call-1",
  clerkUserId: "user-1",
  durationMinutes: 10
};

describe("buildInstructions", () => {
  it("uses an English-only prompt for OPIC", () => {
    const instructions = buildInstructions({
      ...base,
      language: "en",
      exam: "opic",
      level: "IM3",
      topic: "daily conversation"
    });

    expect(instructions).toContain("Conduct the entire conversation only in English.");
    expect(instructions).toContain("Open the session with the first sentence in English.");
    expect(instructions).toContain("daily conversation");
    expect(instructions).toContain("IM3");
  });

  it("uses a German-only prompt for Goethe B2", () => {
    const instructions = buildInstructions({
      ...base,
      language: "de",
      exam: "goethe_b2",
      level: "B1",
      topic: "Studium und Beruf"
    });

    expect(instructions).toContain("Fuehre das Gespraech ausschliesslich auf Deutsch.");
    expect(instructions).toContain("Beginne die Sitzung mit dem ersten Satz auf Deutsch.");
    expect(instructions).toContain("Studium und Beruf");
  });

  it("uses a Mandarin-only prompt for HSK5", () => {
    const instructions = buildInstructions({
      ...base,
      language: "zh",
      exam: "hsk5",
      level: "HSK4",
      topic: "work and career"
    });

    expect(instructions).toContain("Conduct the entire conversation only in Mandarin Chinese.");
    expect(instructions).toContain("Open the session with the first sentence in Mandarin Chinese.");
    expect(instructions).toContain("work and career");
  });

  it("uses a Spanish-only prompt for DELE B1", () => {
    const instructions = buildInstructions({
      ...base,
      language: "es",
      exam: "dele_b1",
      level: "A2",
      topic: "vida cotidiana"
    });

    expect(instructions).toContain("Manten toda la conversacion en espanol.");
    expect(instructions).toContain("Empieza la sesion con la primera frase en espanol.");
    expect(instructions).toContain("vida cotidiana");
  });

  it("uses a Japanese-only prompt for JLPT N2", () => {
    const instructions = buildInstructions({
      ...base,
      language: "ja",
      exam: "jlpt_n2",
      level: "N3",
      topic: "work and everyday life"
    });

    expect(instructions).toContain("Conduct the entire conversation only in Japanese.");
    expect(instructions).toContain("Open the session with the first sentence in Japanese.");
    expect(instructions).toContain("work and everyday life");
  });

  it("uses a French-only prompt for DELF B1", () => {
    const instructions = buildInstructions({
      ...base,
      language: "fr",
      exam: "delf_b1",
      level: "A2",
      topic: "vie quotidienne"
    });

    expect(instructions).toContain("Conduis toute la conversation en francais.");
    expect(instructions).toContain("Commence la session avec la premiere phrase en francais.");
    expect(instructions).toContain("vie quotidienne");
  });

  it("falls back to English for unsupported combinations", () => {
    const instructions = buildInstructions({
      ...base,
      language: "ko",
      exam: "topik",
      level: "3",
      topic: "everyday life"
    });

    expect(instructions).toContain("Conduct the entire conversation only in English.");
  });
});
