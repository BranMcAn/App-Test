import { z } from "zod";

export const RecommendationSchema = z.object({
  suggested_course_ids: z.array(z.string()),
  ranking_reasoning: z.array(z.string()),
  explanations: z.array(z.string()),
  confidence_level: z.enum(["low", "medium", "high"]),
  missing_inputs: z.array(z.string()),
  disclaimer: z.string()
});

export type RecommendationOutput = z.infer<typeof RecommendationSchema>;

export const RecommendationRequestSchema = z.object({
  location: z.string().trim().optional().default(""),
  weaponSystem: z.string().trim().optional().default(""),
  date: z.string().trim().optional().default(""),
  distanceMiles: z.coerce.number().int().positive().optional(),
  skillLevel: z.string().trim().optional().default(""),
  gearConstraints: z.string().trim().optional().default("")
});

export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;

export type CourseRecord = {
  id: string;
  title: string;
  category: string | null;
  weapon_system: string | null;
  start_date: string | null;
  distance_miles: number | null;
  duration_days: number | null;
  skill_level: string | null;
  gear_requirements: string | null;
};

export const RecommendationDisclaimer =
  "Discovery assistance only. This platform does not provide firearms instruction, tactical guidance, legal advice, or weapon modification advice.";