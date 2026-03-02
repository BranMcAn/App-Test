import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import {
  RecommendationSchema,
  type CourseRecord,
  type RecommendationOutput,
  type RecommendationRequest
} from "@/lib/ai/schema";

const OpenAIResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string()
        })
      })
    )
    .min(1)
});

function buildPrompt(input: RecommendationRequest, courses: CourseRecord[], fallback: RecommendationOutput): string {
  return [
    "You are a discovery ranking assistant for civilian firearms training listings.",
    "Never provide instruction or tactical advice.",
    "Return JSON only with this exact shape:",
    '{"suggested_course_ids":[],"ranking_reasoning":[],"explanations":[],"confidence_level":"low|medium|high","missing_inputs":[],"disclaimer":""}',
    "Never invent course IDs. Use only IDs from candidate_courses.",
    "Treat Long Range and Precision Rifle as a first-class system distinct from generic rifle.",
    "Input:",
    JSON.stringify(input),
    "candidate_courses:",
    JSON.stringify(courses),
    "deterministic_fallback:",
    JSON.stringify(fallback)
  ].join("\n");
}

export async function requestAIRecommendations(
  input: RecommendationRequest,
  courses: CourseRecord[],
  fallback: RecommendationOutput
): Promise<RecommendationOutput | null> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You provide explainable course ranking for discovery only. No firearms instruction, legal advice, or tactical content."
          },
          {
            role: "user",
            content: buildPrompt(input, courses, fallback)
          }
        ],
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = OpenAIResponseSchema.parse(await response.json());
    const content = payload.choices[0]?.message.content;
    if (!content) {
      return null;
    }

    const parsed = RecommendationSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      return null;
    }

    const validIds = new Set(courses.map((course) => course.id));
    const filteredIds = parsed.data.suggested_course_ids.filter((id) => validIds.has(id));

    return {
      ...parsed.data,
      suggested_course_ids: filteredIds
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}