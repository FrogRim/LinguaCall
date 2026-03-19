import { TranscriptMessage, ReportEvaluatorInput, ReportEvaluatorOutput } from "@lingua/shared";

type ValidatorState = {
  score: number;
  min: number;
  max: number;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const normalizeScore = (value: unknown, fallback: number): number => {
  const parsed = toNumber(value);
  if (parsed === undefined) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
};

const asCorrectionTimestamp = (timestampMs?: number | null): number => {
  if (!Number.isFinite(timestampMs ?? Number.NaN)) {
    return 0;
  }
  return Math.max(0, Math.trunc(timestampMs!));
};

const countRoleWords = (messages: TranscriptMessage[], role: TranscriptMessage["role"]): number => {
  return messages
    .filter((message) => message.role === role)
    .reduce((sum, message) => {
      const normalized = normalizeText(message.content);
      if (!normalized) {
        return sum;
      }
      return sum + normalized.split(/\s+/).length;
    }, 0);
};

const splitTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const buildFallbackOutput = (context: {
  topic: string;
  level: string;
  messages: TranscriptMessage[];
  totalWords: number;
  accuracyFlags?: string[];
}): ReportEvaluatorOutput => {
  const userWords = countRoleWords(context.messages, "user");
  const assistantWords = countRoleWords(context.messages, "assistant");
  const filledWords = context.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.toLowerCase())
    .join(" ");

  const hasTopicPhrase = normalizeText(context.topic).length > 0
    && filledWords.includes(normalizeText(context.topic).toLowerCase());
  const hasLevelPhrase = normalizeText(context.level).length > 0
    && filledWords.includes(normalizeText(context.level).toLowerCase());

  const uniqueTokenCount = new Set(splitTokens(filledWords)).size;
  const repetitions = Math.max(0, splitTokens(filledWords).length - uniqueTokenCount);
  const grammarScore = clampInt(72 + Math.min(20, uniqueTokenCount), 0, 100) - Math.min(10, repetitions);
  const vocabScore = clampInt(65 + Math.min(25, uniqueTokenCount), 0, 100) - (userWords > 0 ? Math.min(8, Math.floor(repetitions / 4)) : 4);
  const fluencyScore = clampInt(68 + Math.min(22, assistantWords), 0, 100);
  const topicScore = (hasTopicPhrase ? 84 : 72) + (hasLevelPhrase ? 6 : 0) + Math.min(6, context.totalWords);
  const totalScore = clampInt((grammarScore + vocabScore + fluencyScore + topicScore) / 4, 0, 100);

  const recommendations = [
    hasTopicPhrase ? "Keep using topic-specific examples to strengthen response depth." : "Anchor answers around your selected topic more explicitly.",
    hasLevelPhrase ? "Add connective phrases to improve coherence and fluency." : "Use a higher-level structure: opening, supporting examples, and conclusion."
  ];
  if (context.accuracyFlags?.includes("topic_drift_detected")) {
    recommendations.push("Stay closer to the assigned session topic throughout the conversation.");
  }
  if (context.accuracyFlags?.includes("intent_mismatch_detected")) {
    recommendations.push("Respond more directly to the partner's latest question before expanding the answer.");
  }
  if (context.accuracyFlags?.includes("correction_mismatch_detected")) {
    recommendations.push("Keep corrections tightly linked to the exact sentence you just said.");
  }

  const userCorrections = context.messages
    .filter((message) => message.role === "user")
    .map((message) => {
      const normalized = normalizeText(message.content);
      if (!normalized || normalized.length < 6) {
        return undefined;
      }
      const first = normalized.split(/\s+/).slice(0, 3).join(" ");
      const suggestion = `${first} ...`;
      return {
        timestamp_ms_from_call_start: asCorrectionTimestamp(message.timestampMs),
        issue: first,
        suggestion
      };
    })
    .filter(Boolean)
    .slice(0, 3) as ReportEvaluatorOutput["grammar_corrections"];

  return {
    grammar_score: grammarScore,
    vocabulary_score: vocabScore,
    fluency_score: fluencyScore,
    topic_score: clampInt(topicScore, 0, 100),
    total_score: totalScore,
    level_assessment: context.level || "A2",
    grammar_corrections: userCorrections,
    vocabulary_analysis: [
      context.messages.length === 0 ? "No transcript captured yet." : "Vocabulary analysis generated from transcript coverage.",
      hasTopicPhrase ? "Topic vocabulary appeared in user responses." : "Topic vocabulary coverage is limited."
    ],
    fluency_metrics: {
      avg_wpm: clampInt((userWords + assistantWords) / Math.max(context.messages.length, 1), 0, 240),
      filler_count: Math.max(0, filledWords.split(/\b(um|uh|like|you know)\b/gi).length - 1),
      pause_count: Math.max(0, context.messages.length - 1)
    },
    scoring_version: "mock-en-v1",
    summary_text: `Session ${context.messages.length ? "captured" : "started"} with ${
      userWords + assistantWords
    } words. Duration target ${context.messages.length > 0 ? "was processed" : "awaiting stronger transcript input."}`,
    recommendations
  };
};

const normalizeOutput = (raw: unknown): ReportEvaluatorOutput => {
  if (raw == null || typeof raw !== "object") {
    throw new Error("evaluator output is not an object");
  }
  const root = raw as Record<string, unknown>;

  const output: ReportEvaluatorOutput = {
    grammar_score: normalizeScore(root.grammar_score, 0),
    vocabulary_score: normalizeScore(root.vocabulary_score, 0),
    fluency_score: normalizeScore(root.fluency_score, 0),
    topic_score: normalizeScore(root.topic_score, 0),
    total_score: 0,
    level_assessment: normalizeText(root.level_assessment || root.levelAssessment).toLocaleLowerCase() || "intermediate",
    grammar_corrections: Array.isArray(root.grammar_corrections) ? root.grammar_corrections : [],
    vocabulary_analysis: Array.isArray(root.vocabulary_analysis) ? root.vocabulary_analysis.map(String) : [],
    fluency_metrics: {
      avg_wpm: normalizeScore((root.fluency_metrics as { avg_wpm?: unknown })?.avg_wpm, 0),
      filler_count: normalizeScore((root.fluency_metrics as { filler_count?: unknown })?.filler_count, 0),
      pause_count: normalizeScore((root.fluency_metrics as { pause_count?: unknown })?.pause_count, 0)
    },
    scoring_version: normalizeText(root.scoring_version || root.scoringVersion) || "mock-en-v1",
    summary_text: normalizeText(root.summary_text || root.summaryText),
    recommendations: Array.isArray(root.recommendations) ? root.recommendations.map((entry) => normalizeText(entry)).filter(Boolean) : []
  };

  output.total_score = normalizeScore(
    (root.total_score || root.totalScore),
    Math.round((output.grammar_score + output.vocabulary_score + output.fluency_score + output.topic_score) / 4)
  );
  return output;
};

const validateOutput = (output: ReportEvaluatorOutput): ReportEvaluatorOutput => {
  const ranges: ValidatorState[] = [
    { score: output.grammar_score, min: 0, max: 100 },
    { score: output.vocabulary_score, min: 0, max: 100 },
    { score: output.fluency_score, min: 0, max: 100 },
    { score: output.topic_score, min: 0, max: 100 },
    { score: output.total_score, min: 0, max: 100 }
  ];

  ranges.forEach((entry) => {
    if (!Number.isFinite(entry.score)) {
      throw new Error("evaluation score is invalid");
    }
    entry.score = clampInt(entry.score, entry.min, entry.max);
  });

  if (normalizeText(output.scoring_version).length === 0) {
    output.scoring_version = "mock-en-v1";
  }

  output.level_assessment = normalizeText(output.level_assessment) || "intermediate";
  output.summary_text = normalizeText(output.summary_text) || "Session summary is ready.";

  const safeRecommendations = output.recommendations
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);
  output.recommendations = safeRecommendations.length > 0
    ? safeRecommendations.slice(0, 5)
    : ["Practice longer responses with topic-related details."];

  output.grammar_corrections = (output.grammar_corrections ?? [])
    .map((entry) => ({
      timestamp_ms_from_call_start: Number.isFinite(entry?.timestamp_ms_from_call_start)
        ? Math.max(0, Math.trunc(Number(entry.timestamp_ms_from_call_start)))
        : 0,
      issue: normalizeText((entry as { issue?: unknown })?.issue),
      suggestion: normalizeText((entry as { suggestion?: unknown })?.suggestion)
    }))
    .filter((entry) => entry.issue.length > 0 || entry.suggestion.length > 0)
    .slice(0, 10);

  output.vocabulary_analysis = (output.vocabulary_analysis ?? []).map((entry) => normalizeText(entry)).filter(Boolean).slice(0, 10);

  output.fluency_metrics = {
    avg_wpm: clampInt(output.fluency_metrics?.avg_wpm ?? 0, 0, 1000),
    filler_count: clampInt(output.fluency_metrics?.filler_count ?? 0, 0, 10000),
    pause_count: clampInt(output.fluency_metrics?.pause_count ?? 0, 0, 10000)
  };

  return output;
};

export const evaluateSessionForReport = (input: ReportEvaluatorInput): ReportEvaluatorOutput => {
  const context = {
    language: input.language,
    exam: input.exam,
    level: input.level,
    topic: input.topic,
    messages: input.messages,
    totalWords: 0
  };

  const totalWords = countRoleWords(context.messages, "user") + countRoleWords(context.messages, "assistant");
  const output = buildFallbackOutput({
    topic: context.topic,
    level: context.level,
    messages: context.messages,
    totalWords,
    accuracyFlags: input.accuracyState?.flags
  });
  return validateOutput(output);
};

export const parseReportEvaluatorPayload = (raw: unknown): ReportEvaluatorOutput => {
  return validateOutput(normalizeOutput(raw));
};

export type { ReportEvaluatorOutput };
