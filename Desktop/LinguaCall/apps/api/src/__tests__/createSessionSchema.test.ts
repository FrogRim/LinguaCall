import { describe, expect, it } from "vitest";

import { CreateSessionSchema } from "../schemas/createSession";

describe("CreateSessionSchema", () => {
  it("accepts the Japanese track already supported by the rest of the app", () => {
    const result = CreateSessionSchema.safeParse({
      language: "ja",
      exam: "jlpt_n2",
      level: "N3",
      topic: "work and daily life",
      durationMinutes: 10,
      contactMode: "immediate"
    });

    expect(result.success).toBe(true);
  });

  it("accepts the French track already supported by the rest of the app", () => {
    const result = CreateSessionSchema.safeParse({
      language: "fr",
      exam: "delf_b1",
      level: "A2",
      topic: "vie quotidienne",
      durationMinutes: 10,
      contactMode: "immediate"
    });

    expect(result.success).toBe(true);
  });
});
