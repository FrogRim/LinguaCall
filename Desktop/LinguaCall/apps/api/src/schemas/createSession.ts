import { z } from "zod";

export const CreateSessionSchema = z.object({
  language: z.enum(["en", "de", "zh", "es", "ja", "fr"]),
  exam: z.enum(["opic", "goethe_b2", "hsk5", "dele_b1", "jlpt_n2", "delf_b1"]),
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
