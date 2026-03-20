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
    scoring_version: "fallback-v1",
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
    scoring_version: normalizeText(root.scoring_version || root.scoringVersion) || "fallback-v1",
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
    output.scoring_version = "fallback-v1";
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

const callGptEvaluator = async (systemPrompt: string, userPrompt: string): Promise<unknown> => {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = (process.env.OPENAI_EVAL_MODEL ?? "gpt-5.4-mini").trim();
  const url = (process.env.OPENAI_EVAL_URL ?? "https://api.openai.com/v1/chat/completions").trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`gpt_eval_api_error: ${response.status} ${text}`.trim());
    }
    const payload = await response.json() as Record<string, unknown>;
    const content = (payload?.choices as Array<Record<string, unknown>>)?.[0]?.message;
    const messageContent = (content as Record<string, unknown> | undefined)?.content;
    if (typeof messageContent !== "string") throw new Error("gpt_eval_empty_response");
    return JSON.parse(messageContent);
  } finally {
    clearTimeout(timeoutId);
  }
};

const buildEnglishEvalPrompt = (topic: string, exam: string): string => `
You are an expert OPIC (Oral Proficiency Interview by Computer) examiner evaluating an English speaking session.
Rubric levels: NL (Novice Low) → NM → NH → IL → IM1 → IM2 → IM3 → IH → AL (Advanced Low).
Exam: ${exam.toUpperCase()}, Topic: "${topic}".

Evaluate the transcript and return a JSON object with EXACTLY these fields:
{
  "grammar_score": <0-100 integer, based on grammatical accuracy>,
  "vocabulary_score": <0-100 integer, range and appropriateness of vocabulary>,
  "fluency_score": <0-100 integer, delivery pace and hesitation>,
  "topic_score": <0-100 integer, relevance and depth on topic>,
  "total_score": <0-100 integer, weighted average>,
  "level_assessment": "<OPIC band label, e.g. IM2>",
  "grammar_corrections": [
    {"timestamp_ms_from_call_start": <number>, "issue": "<brief description>", "suggestion": "<corrected form>"}
  ],
  "vocabulary_analysis": ["<observation 1>", "<observation 2>"],
  "fluency_metrics": {"avg_wpm": <integer>, "filler_count": <integer>, "pause_count": <integer>},
  "scoring_version": "gpt-eval-v1",
  "summary_text": "<2-3 sentence summary of performance>",
  "recommendations": ["<actionable tip 1>", "<actionable tip 2>", "<actionable tip 3>"]
}
`.trim();

const buildGermanEvalPrompt = (topic: string): string => `
Du bist ein Experte für die Goethe-Zertifikat B2 Sprechprüfung und bewertest eine deutschsprachige Übungssitzung.
Bewertungskriterien nach Goethe B2 Sprechen: Inhalt, Interaktion, Aussprache/Intonation, Grammatik, Wortschatz.
Thema: "${topic}".

Bewerte das Transkript und gib ein JSON-Objekt mit GENAU diesen Feldern zurück:
{
  "grammar_score": <0-100 Ganzzahl, Grammatikgenauigkeit>,
  "vocabulary_score": <0-100 Ganzzahl, Wortschatzumfang und Angemessenheit>,
  "fluency_score": <0-100 Ganzzahl, Redefluss und Aussprache>,
  "topic_score": <0-100 Ganzzahl, thematische Relevanz und Tiefe>,
  "total_score": <0-100 Ganzzahl, gewichteter Durchschnitt>,
  "level_assessment": "<GER-Niveau z.B. B1, B2>",
  "grammar_corrections": [
    {"timestamp_ms_from_call_start": <Zahl>, "issue": "<kurze Beschreibung>", "suggestion": "<korrigierte Form>"}
  ],
  "vocabulary_analysis": ["<Beobachtung 1>", "<Beobachtung 2>"],
  "fluency_metrics": {"avg_wpm": <Ganzzahl>, "filler_count": <Ganzzahl>, "pause_count": <Ganzzahl>},
  "scoring_version": "gpt-eval-v1",
  "summary_text": "<2-3 Sätze zur Leistungszusammenfassung>",
  "recommendations": ["<Tipp 1>", "<Tipp 2>", "<Tipp 3>"]
}
`.trim();

const buildChineseEvalPrompt = (topic: string): string => `
你是一位HSK 5级口语考试专家，负责评估一次中文口语练习课程。
评分标准（HSK 5口语）：语音语调、词汇量、语法准确性、话题表达、连贯性。
话题："${topic}"。

请评估以下对话记录，并返回一个包含以下字段的JSON对象：
{
  "grammar_score": <0-100整数，语法准确性>,
  "vocabulary_score": <0-100整数，词汇范围和适当性>,
  "fluency_score": <0-100整数，流利度和语音节奏>,
  "topic_score": <0-100整数，话题相关性和表达深度>,
  "total_score": <0-100整数，加权平均分>,
  "level_assessment": "<HSK级别，例如HSK4、HSK5>",
  "grammar_corrections": [
    {"timestamp_ms_from_call_start": <数字>, "issue": "<简短描述>", "suggestion": "<修正形式>"}
  ],
  "vocabulary_analysis": ["<观察1>", "<观察2>"],
  "fluency_metrics": {"avg_wpm": <整数>, "filler_count": <整数>, "pause_count": <整数>},
  "scoring_version": "gpt-eval-v1",
  "summary_text": "<2-3句话的表现总结>",
  "recommendations": ["<建议1>", "<建议2>", "<建议3>"]
}
`.trim();

const buildSpanishEvalPrompt = (topic: string): string => `
Eres un experto examinador del DELE B1 Expresión e Interacción Orales y evalúas una sesión de práctica en español.
Criterios DELE B1 Oral: coherencia y cohesión, riqueza léxica, corrección gramatical, pronunciación, adecuación al tema.
Tema: "${topic}".

Evalúa la transcripción y devuelve un objeto JSON con EXACTAMENTE estos campos:
{
  "grammar_score": <0-100 entero, corrección gramatical>,
  "vocabulary_score": <0-100 entero, riqueza léxica y adecuación>,
  "fluency_score": <0-100 entero, fluidez y pronunciación>,
  "topic_score": <0-100 entero, relevancia y profundidad temática>,
  "total_score": <0-100 entero, promedio ponderado>,
  "level_assessment": "<nivel MCER, e.g. B1, B2>",
  "grammar_corrections": [
    {"timestamp_ms_from_call_start": <número>, "issue": "<descripción breve>", "suggestion": "<forma corregida>"}
  ],
  "vocabulary_analysis": ["<observación 1>", "<observación 2>"],
  "fluency_metrics": {"avg_wpm": <entero>, "filler_count": <entero>, "pause_count": <entero>},
  "scoring_version": "gpt-eval-v1",
  "summary_text": "<resumen del rendimiento en 2-3 frases>",
  "recommendations": ["<consejo 1>", "<consejo 2>", "<consejo 3>"]
}
`.trim();

const buildJapaneseEvalPrompt = (topic: string): string => `
あなたはJLPT N2口頭能力評価の専門家です。日本語スピーキングセッションを評価してください。
評価基準（JLPT N2スピーキング）：文法の正確さ、語彙の豊富さ、流暢さ・発音・リズム、トピックへの対応力。
トピック：「${topic}」。

以下のフィールドを含むJSONオブジェクトを返してください：
{
  "grammar_score": <0-100の整数、文法の正確さ>,
  "vocabulary_score": <0-100の整数、語彙の範囲と適切さ>,
  "fluency_score": <0-100の整数、流暢さとリズム>,
  "topic_score": <0-100の整数、トピックへの関連性と深度>,
  "total_score": <0-100の整数、加重平均>,
  "level_assessment": "<JLPTレベル、例：N3、N2、N1>",
  "grammar_corrections": [
    {"timestamp_ms_from_call_start": <数値>, "issue": "<簡単な説明>", "suggestion": "<修正後の形>"}
  ],
  "vocabulary_analysis": ["<観察1>", "<観察2>"],
  "fluency_metrics": {"avg_wpm": <整数>, "filler_count": <整数>, "pause_count": <整数>},
  "scoring_version": "gpt-eval-v1",
  "summary_text": "<2〜3文のパフォーマンスサマリー>",
  "recommendations": ["<アドバイス1>", "<アドバイス2>", "<アドバイス3>"]
}
`.trim();

const buildFrenchEvalPrompt = (topic: string): string => `
Tu es un expert de l'examen DELF B1 Expression et Interaction Orales et tu evalues une session de pratique en francais.
Criteres DELF B1 Oral : coherence et cohesion, richesse lexicale, correction grammaticale, prononciation, adequation au sujet.
Sujet : "${topic}".

Retourne un objet JSON avec EXACTEMENT ces champs :
{
  "grammar_score": <entier 0-100, correction grammaticale>,
  "vocabulary_score": <entier 0-100, richesse lexicale et adequation>,
  "fluency_score": <entier 0-100, fluidite et prononciation>,
  "topic_score": <entier 0-100, pertinence et profondeur thematique>,
  "total_score": <entier 0-100, moyenne ponderee>,
  "level_assessment": "<niveau CECRL, ex. B1, B2>",
  "grammar_corrections": [
    {"timestamp_ms_from_call_start": <nombre>, "issue": "<description breve>", "suggestion": "<forme corrigee>"}
  ],
  "vocabulary_analysis": ["<observation 1>", "<observation 2>"],
  "fluency_metrics": {"avg_wpm": <entier>, "filler_count": <entier>, "pause_count": <entier>},
  "scoring_version": "gpt-eval-v1",
  "summary_text": "<resume de la performance en 2-3 phrases>",
  "recommendations": ["<conseil 1>", "<conseil 2>", "<conseil 3>"]
}
`.trim();

const buildEvalSystemPrompt = (input: ReportEvaluatorInput): string => {
  if (input.language === "de" && input.exam === "goethe_b2") return buildGermanEvalPrompt(input.topic);
  if (input.language === "zh" && input.exam === "hsk5")       return buildChineseEvalPrompt(input.topic);
  if (input.language === "es" && input.exam === "dele_b1")    return buildSpanishEvalPrompt(input.topic);
  if (input.language === "ja" && input.exam === "jlpt_n2")    return buildJapaneseEvalPrompt(input.topic);
  if (input.language === "fr" && input.exam === "delf_b1")    return buildFrenchEvalPrompt(input.topic);
  return buildEnglishEvalPrompt(input.topic, input.exam);
};

const buildEvalUserPrompt = (input: ReportEvaluatorInput): string => {
  let userLabel: string;
  let assistantLabel: string;

  if (input.language === "de") {
    userLabel = "LERNENDER";
    assistantLabel = "ASSISTENT";
  } else if (input.language === "zh") {
    userLabel = "用户";
    assistantLabel = "助手";
  } else if (input.language === "es") {
    userLabel = "ESTUDIANTE";
    assistantLabel = "ASISTENTE";
  } else if (input.language === "ja") {
    userLabel = "学習者";
    assistantLabel = "アシスタント";
  } else if (input.language === "fr") {
    userLabel = "APPRENANT";
    assistantLabel = "ASSISTANT";
  } else {
    userLabel = "USER";
    assistantLabel = "ASSISTANT";
  }

  const lines = input.messages.map((msg) => {
    const label = msg.role === "user" ? userLabel : assistantLabel;
    return `[${label}]: ${msg.content}`;
  });

  return lines.join("\n\n");
};

export const evaluateSessionForReport = async (
  input: ReportEvaluatorInput
): Promise<ReportEvaluatorOutput> => {
  const totalWords = countRoleWords(input.messages, "user") + countRoleWords(input.messages, "assistant");
  const fallbackCtx = {
    topic: input.topic,
    level: input.level,
    messages: input.messages,
    totalWords,
    accuracyFlags: input.accuracyState?.flags
  };

  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey || input.messages.length < 2) {
    return validateOutput(buildFallbackOutput(fallbackCtx));
  }

  try {
    const raw = await callGptEvaluator(
      buildEvalSystemPrompt(input),
      buildEvalUserPrompt(input)
    );
    const parsed = normalizeOutput(raw);
    parsed.scoring_version = "gpt-eval-v1";
    return validateOutput(parsed);
  } catch {
    return validateOutput(buildFallbackOutput(fallbackCtx));
  }
};

export const parseReportEvaluatorPayload = (raw: unknown): ReportEvaluatorOutput => {
  return validateOutput(normalizeOutput(raw));
};

export type { ReportEvaluatorOutput };

// Exported for testing
export {
  buildEnglishEvalPrompt,
  buildGermanEvalPrompt,
  buildChineseEvalPrompt,
  buildSpanishEvalPrompt,
  buildJapaneseEvalPrompt,
  buildFrenchEvalPrompt,
  buildEvalUserPrompt
};
