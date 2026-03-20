import { describe, it, expect, vi, afterEach } from "vitest";
import {
  evaluateSessionForReport,
  buildEnglishEvalPrompt,
  buildGermanEvalPrompt,
  buildChineseEvalPrompt,
  buildSpanishEvalPrompt,
  buildJapaneseEvalPrompt,
  buildFrenchEvalPrompt,
  buildEvalUserPrompt
} from "../services/reportEvaluator";
import { ReportEvaluatorInput } from "@lingua/shared";

const makeMsg = (role: "user" | "assistant", content: string, timestampMs: number, sequenceNo: number) => ({
  role,
  content,
  timestampMs,
  isFinal: true as const,
  sequenceNo,
  createdAt: new Date(timestampMs).toISOString()
});

const baseAccuracyState = {
  validationVersion: "v1",
  driftDetected: false,
  intentMismatchDetected: false,
  correctionMismatchDetected: false,
  flags: [] as string[]
};

const baseInput: ReportEvaluatorInput = {
  sessionId: "sess-test-1",
  language: "en",
  exam: "opic",
  level: "IM2",
  topic: "daily routine",
  durationMinutes: 10,
  messages: [
    makeMsg("user", "I wake up at seven every morning.", 1000, 1),
    makeMsg("assistant", "That sounds like a healthy routine. What do you do next?", 3000, 2),
    makeMsg("user", "I usually have breakfast and then commute to work.", 6000, 3)
  ],
  accuracyState: baseAccuracyState
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENAI_API_KEY;
});

// ─── 1. Prompt builder tests (pure functions) ────────────────────────────────

describe("buildEnglishEvalPrompt", () => {
  const prompt = buildEnglishEvalPrompt("daily routine", "opic");

  it("contains OPIC rubric reference", () => {
    expect(prompt).toMatch(/OPIC/);
  });
  it("contains grammar_score field spec", () => {
    expect(prompt).toMatch(/grammar_score/);
  });
  it("contains gpt-eval-v1 scoring version", () => {
    expect(prompt).toMatch(/gpt-eval-v1/);
  });
  it("includes the topic", () => {
    expect(prompt).toMatch(/daily routine/);
  });
});

describe("buildGermanEvalPrompt", () => {
  const prompt = buildGermanEvalPrompt("Studium und Beruf");

  it("contains Goethe rubric reference", () => {
    expect(prompt).toMatch(/Goethe/);
  });
  it("contains Grammatik", () => {
    expect(prompt).toMatch(/Grammatik/);
  });
  it("contains gpt-eval-v1 scoring version", () => {
    expect(prompt).toMatch(/gpt-eval-v1/);
  });
});

describe("buildChineseEvalPrompt", () => {
  const prompt = buildChineseEvalPrompt("日常生活");

  it("contains HSK 5 reference", () => {
    expect(prompt).toMatch(/HSK 5/);
  });
  it("contains grammar_score field spec", () => {
    expect(prompt).toMatch(/grammar_score/);
  });
});

describe("buildSpanishEvalPrompt", () => {
  const prompt = buildSpanishEvalPrompt("vida cotidiana");

  it("contains DELE B1 reference", () => {
    expect(prompt).toMatch(/DELE B1/);
  });
  it("contains grammar_score field spec", () => {
    expect(prompt).toMatch(/grammar_score/);
  });
});

describe("buildJapaneseEvalPrompt", () => {
  const prompt = buildJapaneseEvalPrompt("仕事と日常生活");

  it("contains JLPT N2 reference", () => {
    expect(prompt).toMatch(/JLPT N2/);
  });
  it("contains grammar_score field spec", () => {
    expect(prompt).toMatch(/grammar_score/);
  });
  it("contains gpt-eval-v1 scoring version", () => {
    expect(prompt).toMatch(/gpt-eval-v1/);
  });
  it("includes the topic", () => {
    expect(prompt).toMatch(/仕事と日常生活/);
  });
});

describe("buildFrenchEvalPrompt", () => {
  const prompt = buildFrenchEvalPrompt("vie quotidienne");

  it("contains DELF B1 reference", () => {
    expect(prompt).toMatch(/DELF B1/);
  });
  it("contains grammar_score field spec", () => {
    expect(prompt).toMatch(/grammar_score/);
  });
  it("contains gpt-eval-v1 scoring version", () => {
    expect(prompt).toMatch(/gpt-eval-v1/);
  });
});

describe("buildEvalUserPrompt", () => {
  it("uses LERNENDER label for German", () => {
    const result = buildEvalUserPrompt({ ...baseInput, language: "de", exam: "goethe_b2" });
    expect(result).toMatch(/LERNENDER/);
    expect(result).toMatch(/ASSISTENT/);
  });

  it("uses 用户 label for Chinese", () => {
    const result = buildEvalUserPrompt({ ...baseInput, language: "zh", exam: "hsk5" });
    expect(result).toMatch(/用户/);
    expect(result).toMatch(/助手/);
  });

  it("uses ESTUDIANTE label for Spanish", () => {
    const result = buildEvalUserPrompt({ ...baseInput, language: "es", exam: "dele_b1" });
    expect(result).toMatch(/ESTUDIANTE/);
    expect(result).toMatch(/ASISTENTE/);
  });

  it("uses 学習者 label for Japanese", () => {
    const result = buildEvalUserPrompt({ ...baseInput, language: "ja", exam: "jlpt_n2" });
    expect(result).toMatch(/学習者/);
    expect(result).toMatch(/アシスタント/);
  });

  it("uses APPRENANT label for French", () => {
    const result = buildEvalUserPrompt({ ...baseInput, language: "fr", exam: "delf_b1" });
    expect(result).toMatch(/APPRENANT/);
    expect(result).toMatch(/ASSISTANT/);
  });

  it("uses USER label for English", () => {
    const result = buildEvalUserPrompt(baseInput);
    expect(result).toMatch(/USER/);
    expect(result).toMatch(/ASSISTANT/);
  });

  it("includes message content", () => {
    const result = buildEvalUserPrompt(baseInput);
    expect(result).toMatch(/I wake up at seven/);
  });
});

// ─── 2. Fallback path tests ───────────────────────────────────────────────────

describe("evaluateSessionForReport — fallback path", () => {
  it("returns fallback output when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await evaluateSessionForReport(baseInput);
    expect(result.scoring_version).toBe("fallback-v1");
    expect(result.grammar_score).toBeGreaterThanOrEqual(0);
    expect(result.grammar_score).toBeLessThanOrEqual(100);
  });

  it("returns fallback output when transcript has fewer than 2 messages", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const result = await evaluateSessionForReport({
      ...baseInput,
      messages: [makeMsg("user", "Hello.", 1000, 1)]
    });
    expect(result.scoring_version).toBe("fallback-v1");
  });

  it("returns fallback output when messages array is empty", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await evaluateSessionForReport({ ...baseInput, messages: [] });
    expect(result.scoring_version).toBe("fallback-v1");
  });
});

// ─── 3. GPT response parsing tests ───────────────────────────────────────────

const gptSuccessBody = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          grammar_score: 82,
          vocabulary_score: 78,
          fluency_score: 85,
          topic_score: 80,
          total_score: 81,
          level_assessment: "IM3",
          grammar_corrections: [],
          vocabulary_analysis: ["Good range of everyday vocabulary."],
          fluency_metrics: { avg_wpm: 120, filler_count: 2, pause_count: 3 },
          scoring_version: "gpt-eval-v1",
          summary_text: "The speaker demonstrated solid intermediate proficiency.",
          recommendations: ["Work on complex sentence structures.", "Expand topic-specific vocabulary."]
        })
      }
    }
  ]
};

describe("evaluateSessionForReport — GPT success", () => {
  it("returns GPT scores and gpt-eval-v1 version on success", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => gptSuccessBody
    }));

    const result = await evaluateSessionForReport(baseInput);
    expect(result.scoring_version).toBe("gpt-eval-v1");
    expect(result.grammar_score).toBe(82);
    expect(result.vocabulary_score).toBe(78);
    expect(result.fluency_score).toBe(85);
    expect(result.topic_score).toBe(80);
  });

  it("clamps string scores to 0-100", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const bodyWithStringScores = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              grammar_score: "150",
              vocabulary_score: "-5",
              fluency_score: "70",
              topic_score: "60",
              total_score: "100",
              level_assessment: "IH",
              grammar_corrections: [],
              vocabulary_analysis: [],
              fluency_metrics: { avg_wpm: 100, filler_count: 1, pause_count: 2 },
              scoring_version: "gpt-eval-v1",
              summary_text: "Good session.",
              recommendations: ["Keep practicing."]
            })
          }
        }
      ]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => bodyWithStringScores
    }));

    const result = await evaluateSessionForReport(baseInput);
    expect(result.grammar_score).toBe(100);
    expect(result.vocabulary_score).toBe(0);
  });
});

describe("evaluateSessionForReport — GPT error fallback", () => {
  it("falls back gracefully on HTTP 500", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error"
    }));

    const result = await evaluateSessionForReport(baseInput);
    expect(result.scoring_version).toBe("fallback-v1");
  });

  it("falls back gracefully on AbortError (timeout)", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
    ));

    const result = await evaluateSessionForReport(baseInput);
    expect(result.scoring_version).toBe("fallback-v1");
  });

  it("falls back gracefully when response content is not JSON", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not valid json {{{" } }]
      })
    }));

    const result = await evaluateSessionForReport(baseInput);
    expect(result.scoring_version).toBe("fallback-v1");
  });

  it("falls back gracefully when choices array is missing", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] })
    }));

    const result = await evaluateSessionForReport(baseInput);
    expect(result.scoring_version).toBe("fallback-v1");
  });
});
