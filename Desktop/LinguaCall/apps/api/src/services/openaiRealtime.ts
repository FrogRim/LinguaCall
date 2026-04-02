import { SessionAccuracyPolicy } from "@lingua/shared";

const readEnv = (value?: string): string | undefined => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
};

const readStringValue = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized.length > 0) {
        return normalized;
      }
      continue;
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return undefined;
};

const readExpiresAt = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized.length > 0) {
        return normalized;
      }
      continue;
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      const epochMs = candidate > 1_000_000_000_000 ? candidate : candidate * 1000;
      return new Date(epochMs).toISOString();
    }
  }
  return undefined;
};

export type CreateOpenAIRealtimeSessionInput = {
  sessionId: string;
  callId: string;
  clerkUserId: string;
  language: string;
  exam: string;
  topic: string;
  level: string;
  durationMinutes: number;
  accuracyPolicy?: SessionAccuracyPolicy;
  recentErrorPatterns?: string[];
};

export type OpenAIRealtimeSession = {
  clientSecret: string;
  expiresAt?: string;
  model: string;
};

const REALTIME_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  zh: "Mandarin Chinese",
  es: "Spanish",
  ja: "Japanese",
  fr: "French"
};

const REALTIME_TRANSCRIPTION_HINTS: Record<string, string[]> = {
  en: [
    "The learner may be a Korean speaker practicing English.",
    "Preserve intended English words even when pronunciation is accented.",
    "Do not rewrite learner grammar into native English."
  ],
  de: [
    "The learner may pause before nouns and separable verbs.",
    "Keep German learner word order as spoken unless the audio is clearly different."
  ],
  zh: [
    "Prefer Mandarin Chinese words over English substitutions when the audio is close.",
    "Preserve learner wording rather than correcting tones or grammar."
  ],
  es: [
    "Prefer Spanish learner wording even when pronunciation is tentative.",
    "Do not normalize verb endings unless clearly spoken."
  ],
  ja: [
    "The learner may be a Korean speaker practicing Japanese.",
    "Preserve Japanese words faithfully even when mora timing is uneven.",
    "Do not rewrite particles or conjugations into more native Japanese."
  ],
  fr: [
    "The learner may be a Korean speaker practicing French.",
    "Preserve intended French words even when liaison or nasal vowels are weak.",
    "Do not normalize learner grammar into more native French."
  ]
};

const buildConversationPolicyParts = (accuracyPolicy?: SessionAccuracyPolicy) => [
  "Prioritize keeping the conversation moving naturally until the topic feels complete.",
  "Respond to the learner's meaning first, then ask one short follow-up that keeps the topic going.",
  "On your first reply, give a short greeting, confirm the topic naturally, and ask one easy question.",
  "Do not correct every turn.",
  "Favor conversation flow over pronunciation coaching.",
  "Default correction method — use a recast: echo the correct form naturally inside your next reply without labeling it as a correction. Example: learner says 'I go to store yesterday', you reply 'Oh, you went to the store — what did you pick up?' This keeps the conversation flowing while modeling the correct form.",
  "Only give an explicit correction when: the same structural error recurs three or more times in the session, or the error prevents comprehension.",
  "When correcting explicitly: first acknowledge what the learner said, then give the correction in one brief sentence, then continue the conversation. Correct at most ONE error per turn.",
  "If you correct, place the correction after your response instead of before it.",
  "Never spend the full turn on pronunciation drilling.",
  "When you correct, limit it to one brief sentence and then continue the conversation.",
  `Use at most ${accuracyPolicy?.maxAssistantSentences ?? 3} short sentences per turn.`,
  `Ask at most ${accuracyPolicy?.maxAssistantQuestionsPerTurn ?? 1} question per turn.`,
  "Speak slightly slower than natural conversational speed and leave a short pause between sentences.",
  "If you are unsure, ask a short clarifying question instead of guessing.",
  "The learner's speech is transcribed by ASR and may contain artifacts such as repeated words, filler sounds, cut-off mid-word text, or minor mishearings. Always respond to the learner's intended meaning, not the literal transcription.",
  "If a transcribed turn is mostly unintelligible — garbled text, random characters, or no recognizable words — ask one short clarifying question instead of guessing.",
  "Never mention transcription quality, ASR errors, or audio issues to the learner."
];

const BEGINNER_LEVELS = new Set(["NL", "NM", "NH", "A1", "A2"]);
const ADVANCED_LEVELS = new Set(["IH", "AL", "B2", "C1", "C2", "N1", "N2", "HSK5", "HSK6"]);

const INTERMEDIATE_PARTS: string[] = [
  "The learner is at an intermediate level: mix open-ended and specific questions.",
  "Introduce 1–2 natural vocabulary words or phrases per turn by using them naturally in your reply.",
  "If the learner gives a short answer, ask one follow-up question to encourage elaboration."
];

const buildLevelAdaptiveParts = (level: unknown): string[] => {
  if (typeof level !== "string" || !level.trim()) {
    return INTERMEDIATE_PARTS;
  }
  const lvl = level.trim().toUpperCase();

  if (BEGINNER_LEVELS.has(lvl)) {
    return [
      "The learner is at a beginner level: ask simple yes/no or what/where questions only. Avoid idioms, phrasal verbs, and complex sentence structures.",
      "Use short, common vocabulary. Keep sentences under 8 words when possible.",
      "If the learner completes a full sentence, acknowledge it warmly before continuing."
    ];
  }
  if (ADVANCED_LEVELS.has(lvl)) {
    return [
      "The learner is at an advanced level: use follow-up 'why' and 'how' questions to push for reasoning and opinion.",
      "Introduce natural collocations and idiomatic expressions as part of your replies.",
      "If the learner gives a short or vague answer, challenge them to elaborate further."
    ];
  }
  return INTERMEDIATE_PARTS;
};

type RoleplayScenario = {
  readonly keywords: readonly string[];
  readonly localizedParts: Readonly<Partial<Record<string, readonly string[]>>> & { readonly en: readonly string[] };
};

const ROLEPLAY_SCENARIOS: readonly RoleplayScenario[] = [
  {
    keywords: ["interview", "job interview", "hiring", "취업", "면접"],
    localizedParts: {
      en: [
        "Scenario: job interview roleplay. You are the interviewer at a professional company. The learner is the job candidate applying for a position.",
        "Ask competency-based interview questions about the learner's experience, skills, and motivation. Keep a professional but encouraging tone.",
        "After each answer, react naturally as an interviewer — note something the learner said or probe with a brief follow-up — before moving to the next question."
      ],
      de: [
        "Rollenspiel: Vorstellungsgespräch. Du bist der Interviewer eines Unternehmens, der Lernende ist der Bewerber.",
        "Stelle kompetenzbasierte Fragen zu Erfahrungen, Fähigkeiten und Motivation. Bleibe professionell und ermutigend.",
        "Reagiere nach jeder Antwort natürlich — greife etwas Gesagtes auf oder stelle eine kurze Rückfrage."
      ],
      es: [
        "Juego de rol: entrevista de trabajo. Eres el entrevistador de una empresa; el estudiante es el candidato.",
        "Formula preguntas basadas en competencias sobre experiencia, habilidades y motivación. Mantén un tono profesional y alentador.",
        "Tras cada respuesta, reacciona de forma natural — comenta algo dicho o haz una breve pregunta de seguimiento."
      ],
      fr: [
        "Jeu de rôle : entretien d'embauche. Tu es le recruteur d'une entreprise ; l'apprenant est le candidat.",
        "Pose des questions basées sur les compétences : expérience, aptitudes, motivation. Reste professionnel et encourageant.",
        "Après chaque réponse, réagis naturellement — note quelque chose de dit ou pose une brève question de suivi."
      ]
    }
  },
  {
    keywords: ["travel", "airport", "hotel", "check-in", "tourism", "여행", "공항", "호텔"],
    localizedParts: {
      en: [
        "Scenario: travel roleplay. You are a helpful service staff member — adapt your role to the situation (airport check-in agent, hotel receptionist, or tour guide).",
        "Present realistic travel situations: checking in, asking for directions, booking activities, or resolving a minor travel issue.",
        "Stay in character: respond to the learner's requests as real travel staff would, and guide the interaction naturally."
      ],
      de: [
        "Rollenspiel: Reise. Du bist ein hilfreicher Servicemitarbeiter — passe deine Rolle an (Flughafen-Check-in, Hotelrezeption oder Reiseleiter).",
        "Stelle realistische Reisesituationen dar: Einchecken, Wegbeschreibung, Aktivitätsbuchung oder eine kleinere Reisepanne lösen.",
        "Bleibe in der Rolle und reagiere auf die Anfragen des Lernenden wie echtes Servicepersonal."
      ],
      es: [
        "Juego de rol: viaje. Eres un miembro del personal de servicio — adapta tu rol (agente de check-in, recepcionista de hotel o guía turístico).",
        "Presenta situaciones de viaje realistas: check-in, preguntar direcciones, reservar actividades o resolver un contratiempo menor.",
        "Mantén el personaje: responde a las solicitudes del estudiante como lo haría el personal real."
      ],
      fr: [
        "Jeu de rôle : voyage. Tu es un membre du personnel de service — adapte ton rôle (agent d'enregistrement, réceptionniste d'hôtel ou guide touristique).",
        "Présente des situations de voyage réalistes : enregistrement, demande de directions, réservation d'activités ou résolution d'un petit problème.",
        "Reste dans le personnage : réponds aux demandes de l'apprenant comme le ferait un vrai personnel."
      ]
    }
  },
  {
    keywords: ["shopping", "shop", "store", "buying", "market", "쇼핑", "가게", "구매"],
    localizedParts: {
      en: [
        "Scenario: shopping roleplay. You are a shop assistant at a retail store.",
        "Guide the learner through a realistic shopping interaction: greeting, helping find items, suggesting alternatives, or handling payment and returns.",
        "React naturally to the learner's choices and questions as a real shop assistant would."
      ],
      de: [
        "Rollenspiel: Einkaufen. Du bist ein Verkäufer in einem Einzelhandelsgeschäft.",
        "Führe den Lernenden durch eine realistische Einkaufssituation: Begrüßung, Produktberatung, Alternativen vorschlagen oder Zahlung und Umtausch abwickeln.",
        "Reagiere natürlich auf die Wahl und Fragen des Lernenden, wie ein echter Verkäufer es täte."
      ],
      es: [
        "Juego de rol: compras. Eres un dependiente de una tienda minorista.",
        "Guía al estudiante por una interacción de compra realista: saludo, ayuda para encontrar artículos, sugerencia de alternativas, pago o devoluciones.",
        "Reacciona de forma natural a las elecciones y preguntas del estudiante como lo haría un dependiente real."
      ],
      fr: [
        "Jeu de rôle : shopping. Tu es un vendeur dans un magasin de vente au détail.",
        "Guide l'apprenant dans une interaction d'achat réaliste : accueil, aide pour trouver des articles, suggestion d'alternatives, paiement ou retours.",
        "Réagis naturellement aux choix et aux questions de l'apprenant comme le ferait un vrai vendeur."
      ]
    }
  },
  {
    keywords: ["restaurant", "cafe", "dining", "food order", "menu", "식당", "카페", "레스토랑"],
    localizedParts: {
      en: [
        "Scenario: restaurant roleplay. You are a server at a restaurant.",
        "Walk the learner through ordering: greeting, presenting specials, taking the order, handling dietary requests, and checking satisfaction.",
        "Stay in character and react naturally to the learner's choices as a server would."
      ],
      de: [
        "Rollenspiel: Restaurant. Du bist ein Kellner in einem Restaurant.",
        "Führe den Lernenden durch die Bestellung: Begrüßung, Tagesangebote vorstellen, Bestellung aufnehmen, Sonderwünsche klären und nach der Zufriedenheit fragen.",
        "Bleibe in der Rolle und reagiere natürlich auf die Entscheidungen des Lernenden."
      ],
      es: [
        "Juego de rol: restaurante. Eres un camarero en un restaurante.",
        "Acompaña al estudiante durante el pedido: saludo, especialidades, toma del pedido, restricciones dietéticas y consulta de satisfacción.",
        "Mantén el personaje y reacciona de forma natural a las elecciones del estudiante."
      ],
      fr: [
        "Jeu de rôle : restaurant. Tu es un serveur dans un restaurant.",
        "Accompagne l'apprenant tout au long de la commande : accueil, spécialités, prise de commande, demandes alimentaires et vérification de la satisfaction.",
        "Reste dans le personnage et réagis naturellement aux choix de l'apprenant."
      ]
    }
  },
  {
    keywords: ["doctor", "hospital", "clinic", "health", "medical", "symptom", "병원", "의사", "건강"],
    localizedParts: {
      en: [
        "Scenario: medical consultation roleplay. You are a friendly doctor or nurse at a clinic.",
        "Conduct a brief consultation: ask about the learner's symptoms, duration, and relevant lifestyle factors, then give simple accessible advice.",
        "Respond naturally to the learner's descriptions and ask appropriate follow-up clinical questions."
      ],
      de: [
        "Rollenspiel: Arztgespräch. Du bist ein freundlicher Arzt oder eine Krankenschwester in einer Praxis.",
        "Führe eine kurze Konsultation durch: frage nach Symptomen, Dauer und Lebensgewohnheiten des Lernenden und gib dann einfache Ratschläge.",
        "Reagiere natürlich auf die Beschreibungen des Lernenden und stelle geeignete klinische Folgefragen."
      ],
      es: [
        "Juego de rol: consulta médica. Eres un médico o enfermero amable en una clínica.",
        "Realiza una breve consulta: pregunta sobre síntomas, duración y factores de estilo de vida, y luego da consejos simples y accesibles.",
        "Responde de forma natural a las descripciones del estudiante y haz preguntas clínicas de seguimiento apropiadas."
      ],
      fr: [
        "Jeu de rôle : consultation médicale. Tu es un médecin ou une infirmière bienveillant(e) dans un cabinet.",
        "Mène une brève consultation : interroge l'apprenant sur ses symptômes, leur durée et ses habitudes de vie, puis donne des conseils simples.",
        "Réponds naturellement aux descriptions de l'apprenant et pose des questions cliniques de suivi appropriées."
      ]
    }
  },
  {
    keywords: ["phone call", "customer service", "helpdesk", "call center", "전화", "고객서비스"],
    localizedParts: {
      en: [
        "Scenario: phone call roleplay. You are a customer service representative.",
        "Handle the learner's inquiry: greet them, clarify their issue, and provide solutions or escalate appropriately.",
        "Use natural phone conventions (e.g., 'Let me check that for you', 'May I put you on a brief hold?')."
      ],
      de: [
        "Rollenspiel: Telefonat. Du bist ein Kundendienstmitarbeiter.",
        "Bearbeite die Anfrage des Lernenden: Begrüßung, Klärung des Anliegens und Lösungen anbieten oder ggf. weiterleiten.",
        "Nutze natürliche Telefonkonventionen (z. B. 'Einen Moment bitte', 'Ich prüfe das gerne für Sie')."
      ],
      es: [
        "Juego de rol: llamada telefónica. Eres un agente de atención al cliente.",
        "Gestiona la consulta del estudiante: saludo, aclaración del problema y provisión de soluciones o derivación si es necesario.",
        "Usa convenciones naturales de llamada (p. ej., 'Un momento, por favor', 'Voy a comprobar eso para usted')."
      ],
      fr: [
        "Jeu de rôle : appel téléphonique. Tu es un agent du service client.",
        "Traite la demande de l'apprenant : accueil, clarification du problème et proposition de solutions ou transfert si nécessaire.",
        "Utilise les conventions d'un appel téléphonique (ex. : 'Un instant, s'il vous plaît', 'Je vérifie cela pour vous')."
      ]
    }
  }
];

const buildRoleplayScenarioParts = (topic: string, language: string): string[] => {
  if (!topic.trim()) return [];
  const lowerTopic = topic.trim().toLowerCase();
  for (const scenario of ROLEPLAY_SCENARIOS) {
    if (scenario.keywords.some(kw => lowerTopic.includes(kw))) {
      const parts = scenario.localizedParts[language] ?? scenario.localizedParts.en;
      return [...parts];
    }
  }
  return [];
};

const sanitizeErrorPattern = (raw: string): string =>
  raw
    .replace(/[\x00-\x1F\x7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

const buildRecentErrorParts = (errors: string[] | undefined): string[] => {
  if (!errors || errors.length === 0) return [];
  const sanitized = errors
    .slice(0, 3)
    .map(sanitizeErrorPattern)
    .filter(Boolean);
  if (sanitized.length === 0) return [];
  const list = sanitized.map(e => `"${e}"`).join(", ");
  return [
    `The learner has shown recurring errors in recent sessions: ${list}.`,
    "Be especially attentive when these patterns appear again. Apply the recast technique first; switch to explicit correction only if the same error recurs within this session."
  ];
};

const buildLayeredPrompt = (layers: string[][]): string =>
  layers
    .filter(layer => layer.length > 0)
    .map(layer => layer.join(" "))
    .join("\n\n");

const resolveTranscriptionLanguage = (language: string): string | undefined => {
  const normalized = language.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
};

export const buildRealtimeTranscriptionConfig = (
  input: CreateOpenAIRealtimeSessionInput,
  model: string
) => {
  const languageName = REALTIME_LANGUAGE_NAMES[input.language] ?? "the selected target language";
  const transcriptionLanguage = resolveTranscriptionLanguage(input.language);
  const languageHints = REALTIME_TRANSCRIPTION_HINTS[input.language] ?? [];

  return {
    model,
    ...(transcriptionLanguage ? { language: transcriptionLanguage } : {}),
    prompt: [
      `Transcribe the learner faithfully in ${languageName}.`,
      "Preserve hesitations, incomplete phrases, and imperfect grammar.",
      "Do not translate or rewrite the learner's wording.",
      "Prefer the selected learning language unless the learner clearly switches languages.",
      ...languageHints
    ].join(" ")
  };
};

export const buildRealtimeTurnDetectionConfig = () => ({
  type: "semantic_vad" as const,
  eagerness: "low" as const,
  create_response: false,
  interrupt_response: false
});

const buildGermanInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { topic, level, durationMinutes, accuracyPolicy, recentErrorPatterns, language } = input;

  const roleParts = [
    "Du bist LinguaCall, ein Sprachpartner fuer die Goethe-Zertifikat-B2-Sprechpruefung.",
    "Fuehre das Gespraech ausschliesslich auf Deutsch.",
    "Beginne die Sitzung mit dem ersten Satz auf Deutsch.",
    "Bleibe beim aktuellen Thema und wechsle das Thema nur, wenn der Lernende das ausdruecklich verlangt."
  ];

  const contextParts = [
    `Thema der Sitzung: ${topic}.`,
    `Sprachniveau des Lernenden: ${level}, Ziel Goethe B2.`,
    `Sitzungsdauer: ${durationMinutes} Minuten.`
  ];

  const hintParts: string[] = [];
  if (accuracyPolicy?.allowedSubtopicHints.length) {
    hintParts.push(`Bevorzuge diese Teilthemen, wenn sie passen: ${accuracyPolicy.allowedSubtopicHints.join(", ")}.`);
  }
  if (accuracyPolicy?.forbiddenDomainHints.length) {
    hintParts.push(`Vermeide unpassende Themenwechsel wie: ${accuracyPolicy.forbiddenDomainHints.join(", ")}.`);
  }

  return buildLayeredPrompt([
    roleParts,
    contextParts,
    buildRoleplayScenarioParts(topic, language),
    buildConversationPolicyParts(accuracyPolicy),
    buildLevelAdaptiveParts(level),
    buildRecentErrorParts(recentErrorPatterns),
    hintParts
  ]);
};

const buildChineseInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { topic, level, durationMinutes, accuracyPolicy, recentErrorPatterns, language } = input;

  const roleParts = [
    "You are LinguaCall, a live Mandarin Chinese speaking practice partner for HSK 5 preparation.",
    "Conduct the entire conversation only in Mandarin Chinese.",
    "Open the session with the first sentence in Mandarin Chinese.",
    "Stay on the current topic unless the learner explicitly asks to change it."
  ];

  const contextParts = [
    `Session topic: ${topic}.`,
    `Learner level: ${level}, target HSK 5.`,
    `Session duration: ${durationMinutes} minutes.`
  ];

  const hintParts: string[] = [];
  if (accuracyPolicy?.allowedSubtopicHints.length) {
    hintParts.push(`Prefer these subtopic cues when they fit: ${accuracyPolicy.allowedSubtopicHints.join(", ")}.`);
  }
  if (accuracyPolicy?.forbiddenDomainHints.length) {
    hintParts.push(`Avoid drifting into unrelated domains such as: ${accuracyPolicy.forbiddenDomainHints.join(", ")}.`);
  }

  return buildLayeredPrompt([
    roleParts,
    contextParts,
    buildRoleplayScenarioParts(topic, language),
    buildConversationPolicyParts(accuracyPolicy),
    buildLevelAdaptiveParts(level),
    buildRecentErrorParts(recentErrorPatterns),
    hintParts
  ]);
};

const buildSpanishInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { topic, level, durationMinutes, accuracyPolicy, recentErrorPatterns, language } = input;

  const roleParts = [
    "Eres LinguaCall, un companero de practica oral orientado al examen DELE B1.",
    "Manten toda la conversacion en espanol.",
    "Empieza la sesion con la primera frase en espanol.",
    "Manten el tema actual y no cambies de tema salvo que el estudiante lo pida de forma explicita."
  ];

  const contextParts = [
    `Tema de la sesion: ${topic}.`,
    `Nivel del estudiante: ${level}, objetivo DELE B1.`,
    `Duracion de la sesion: ${durationMinutes} minutos.`
  ];

  const hintParts: string[] = [];
  if (accuracyPolicy?.allowedSubtopicHints.length) {
    hintParts.push(`Prefiere estas pistas de subtema cuando encajen: ${accuracyPolicy.allowedSubtopicHints.join(", ")}.`);
  }
  if (accuracyPolicy?.forbiddenDomainHints.length) {
    hintParts.push(`Evita desviarte hacia dominios no relacionados como: ${accuracyPolicy.forbiddenDomainHints.join(", ")}.`);
  }

  return buildLayeredPrompt([
    roleParts,
    contextParts,
    buildRoleplayScenarioParts(topic, language),
    buildConversationPolicyParts(accuracyPolicy),
    buildLevelAdaptiveParts(level),
    buildRecentErrorParts(recentErrorPatterns),
    hintParts
  ]);
};

const buildEnglishInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { topic, level, durationMinutes, accuracyPolicy, recentErrorPatterns, language } = input;

  const roleParts = [
    "You are LinguaCall, a live English speaking practice partner for OPIC preparation.",
    "Conduct the entire conversation only in English.",
    "Open the session with the first sentence in English.",
    "Do not switch to a new topic unless the learner explicitly asks to change the topic.",
    "Stay concise and interactive."
  ];

  const contextParts = [
    `Keep the learner on the current topic: ${topic}.`,
    `Target learner level: ${level}.`,
    `Target session duration: ${durationMinutes} minutes.`
  ];

  const hintParts: string[] = [];
  if (accuracyPolicy?.allowedSubtopicHints.length) {
    hintParts.push(`Prefer these subtopic cues when useful: ${accuracyPolicy.allowedSubtopicHints.join(", ")}.`);
  }
  if (accuracyPolicy?.forbiddenDomainHints.length) {
    hintParts.push(`Avoid drifting into unrelated domains such as: ${accuracyPolicy.forbiddenDomainHints.join(", ")}.`);
  }

  return buildLayeredPrompt([
    roleParts,
    contextParts,
    buildRoleplayScenarioParts(topic, language),
    buildConversationPolicyParts(accuracyPolicy),
    buildLevelAdaptiveParts(level),
    buildRecentErrorParts(recentErrorPatterns),
    hintParts
  ]);
};

const buildJapaneseInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { topic, level, durationMinutes, accuracyPolicy, recentErrorPatterns, language } = input;

  const roleParts = [
    "You are LinguaCall, a live Japanese speaking practice partner for JLPT N2 preparation.",
    "Conduct the entire conversation only in Japanese.",
    "Open the session with the first sentence in Japanese.",
    "Stay on the current topic unless the learner explicitly asks to change it."
  ];

  const contextParts = [
    `Session topic: ${topic}.`,
    `Learner level: ${level}, target JLPT N2.`,
    `Session duration: ${durationMinutes} minutes.`
  ];

  const hintParts: string[] = [];
  if (accuracyPolicy?.allowedSubtopicHints.length) {
    hintParts.push(`Prefer these subtopic cues when they fit: ${accuracyPolicy.allowedSubtopicHints.join(", ")}.`);
  }
  if (accuracyPolicy?.forbiddenDomainHints.length) {
    hintParts.push(`Avoid drifting into unrelated domains such as: ${accuracyPolicy.forbiddenDomainHints.join(", ")}.`);
  }

  return buildLayeredPrompt([
    roleParts,
    contextParts,
    buildRoleplayScenarioParts(topic, language),
    buildConversationPolicyParts(accuracyPolicy),
    buildLevelAdaptiveParts(level),
    buildRecentErrorParts(recentErrorPatterns),
    hintParts
  ]);
};

const buildFrenchInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { topic, level, durationMinutes, accuracyPolicy, recentErrorPatterns, language } = input;

  const roleParts = [
    "Tu es LinguaCall, un partenaire de pratique orale pour la preparation au DELF B1.",
    "Conduis toute la conversation en francais.",
    "Commence la session avec la premiere phrase en francais.",
    "Reste sur le sujet actuel et ne changes de sujet que si l'apprenant le demande explicitement."
  ];

  const contextParts = [
    `Sujet de la session : ${topic}.`,
    `Niveau de l'apprenant : ${level}, objectif DELF B1.`,
    `Duree de la session : ${durationMinutes} minutes.`
  ];

  const hintParts: string[] = [];
  if (accuracyPolicy?.allowedSubtopicHints.length) {
    hintParts.push(`Privilegie ces pistes de sous-sujet si elles sont pertinentes : ${accuracyPolicy.allowedSubtopicHints.join(", ")}.`);
  }
  if (accuracyPolicy?.forbiddenDomainHints.length) {
    hintParts.push(`Evite de deriver vers des domaines non lies comme : ${accuracyPolicy.forbiddenDomainHints.join(", ")}.`);
  }

  return buildLayeredPrompt([
    roleParts,
    contextParts,
    buildRoleplayScenarioParts(topic, language),
    buildConversationPolicyParts(accuracyPolicy),
    buildLevelAdaptiveParts(level),
    buildRecentErrorParts(recentErrorPatterns),
    hintParts
  ]);
};

export const buildInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { language, exam } = input;

  if (language === "de" && exam === "goethe_b2") {
    return buildGermanInstructions(input);
  }

  if (language === "zh" && exam === "hsk5") {
    return buildChineseInstructions(input);
  }

  if (language === "es" && exam === "dele_b1") {
    return buildSpanishInstructions(input);
  }

  if (language === "en" && exam === "opic") {
    return buildEnglishInstructions(input);
  }

  if (language === "ja" && exam === "jlpt_n2") {
    return buildJapaneseInstructions(input);
  }

  if (language === "fr" && exam === "delf_b1") {
    return buildFrenchInstructions(input);
  }

  return buildEnglishInstructions(input);
};

export const createOpenAIRealtimeSession = async (
  input: CreateOpenAIRealtimeSessionInput
): Promise<OpenAIRealtimeSession> => {
  const apiKey = readEnv(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const model = readEnv(process.env.OPENAI_REALTIME_MODEL) ?? "gpt-realtime-mini";
  const voice = readEnv(process.env.OPENAI_REALTIME_VOICE) ?? "marin";
  const transcriptionModel = readEnv(process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL) ?? "gpt-4o-mini-transcribe";
  const sessionUrl = readEnv(process.env.OPENAI_REALTIME_SESSION_URL) ?? "https://api.openai.com/v1/realtime/sessions";

  const response = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      voice,
      speed: 0.9,
      modalities: ["audio", "text"],
      instructions: buildInstructions(input),
      input_audio_transcription: buildRealtimeTranscriptionConfig(input, transcriptionModel),
      turn_detection: buildRealtimeTurnDetectionConfig()
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`failed_to_create_realtime_session: ${response.status} ${text}`.trim());
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const sessionPayload = asRecord(payload.session);
  const clientSecretPayload = asRecord(payload.client_secret) ?? asRecord(sessionPayload?.client_secret);
  const secretPayload = asRecord(payload.secret) ?? asRecord(sessionPayload?.secret);
  const ephemeralPayload =
    asRecord(payload.ephemeral_key) ??
    asRecord(payload.ephemeralKey) ??
    asRecord(sessionPayload?.ephemeral_key) ??
    asRecord(sessionPayload?.ephemeralKey);

  const clientSecretValue = readStringValue(
    clientSecretPayload?.value,
    clientSecretPayload?.secret,
    payload.client_secret,
    secretPayload?.value,
    secretPayload?.secret,
    payload.secret,
    ephemeralPayload?.value,
    ephemeralPayload?.secret,
    payload.clientSecret,
    payload.token,
    sessionPayload?.client_secret,
    sessionPayload?.clientSecret,
    sessionPayload?.token
  );

  if (!clientSecretValue) {
    throw new Error("realtime_session_missing_client_secret");
  }

  const expiresAt = readExpiresAt(
    clientSecretPayload?.expires_at,
    clientSecretPayload?.expiresAt,
    secretPayload?.expires_at,
    secretPayload?.expiresAt,
    ephemeralPayload?.expires_at,
    ephemeralPayload?.expiresAt,
    payload.expires_at,
    payload.expiresAt,
    sessionPayload?.expires_at,
    sessionPayload?.expiresAt
  );

  const resolvedModel = readStringValue(payload.model, sessionPayload?.model, model) ?? model;

  return {
    clientSecret: clientSecretValue,
    expiresAt,
    model: resolvedModel
  };
};
