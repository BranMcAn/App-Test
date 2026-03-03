import { z } from "zod";
import { createHash } from "crypto";
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

const WebDiscoverySchema = z.object({
  courses: z.array(
    z.object({
      title: z.string().min(1),
      provider: z.string().optional(),
      category: z.string().optional(),
      weapon_system: z.string().optional(),
      location_label: z.string().optional(),
      start_date: z.string().optional(),
      distance_miles: z.number().int().nonnegative().optional(),
      duration_days: z.number().int().positive().optional(),
      skill_level: z.string().optional(),
      gear_requirements: z.string().optional(),
      source_url: z.string().optional()
    })
  )
});

function toSyntheticWebId(value: string): string {
  return `web-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function extractResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybe = payload as { output_text?: unknown; output?: unknown };
  if (typeof maybe.output_text === "string" && maybe.output_text.trim()) {
    return maybe.output_text;
  }

  if (!Array.isArray(maybe.output)) {
    return null;
  }

  for (const item of maybe.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        return text;
      }
    }
  }

  return null;
}

function buildWebSearchPrompt(input: RecommendationRequest): string {
  return [
    "Find civilian firearms training course listings on the public web.",
    "Discovery only. Do not provide firearms instruction, tactics, legal advice, or modifications.",
    "Prioritize official provider pages with registration links.",
    "Treat Long Range / Precision Rifle as distinct from generic rifle.",
    "Return strict JSON only with this shape:",
    "{\"courses\":[{\"title\":\"\",\"provider\":\"\",\"category\":\"\",\"weapon_system\":\"\",\"location_label\":\"\",\"start_date\":\"YYYY-MM-DD or empty\",\"distance_miles\":0,\"duration_days\":1,\"skill_level\":\"\",\"gear_requirements\":\"\",\"source_url\":\"https://...\"}]}",
    "Input filters:",
    JSON.stringify(input)
  ].join("\n");
}

function buildBroadenedWebSearchPrompt(input: RecommendationRequest): string {
  return [
    "Find civilian firearms training course listings on the public web.",
    "Discovery only. Do not provide firearms instruction, tactics, legal advice, or modifications.",
    "If strict filter matches are sparse, return nearby or upcoming alternatives and include available metadata.",
    "Treat Long Range / Precision Rifle as distinct from generic rifle.",
    "Return strict JSON only with this shape:",
    "{\"courses\":[{\"title\":\"\",\"provider\":\"\",\"category\":\"\",\"weapon_system\":\"\",\"location_label\":\"\",\"start_date\":\"YYYY-MM-DD or empty\",\"distance_miles\":0,\"duration_days\":1,\"skill_level\":\"\",\"gear_requirements\":\"\",\"source_url\":\"https://...\"}]}",
    "Primary filters (soften date and distance if needed):",
    JSON.stringify(input)
  ].join("\n");
}

function parseWebDiscoveryText(rawText: string): z.infer<typeof WebDiscoverySchema> | null {
  const candidates = [rawText];
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1]);
  }
  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    candidates.push(objectMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed = WebDiscoverySchema.safeParse(JSON.parse(candidate));
      if (parsed.success) {
        return parsed.data;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeWebCourses(courses: z.infer<typeof WebDiscoverySchema>["courses"]): CourseRecord[] {
  return courses.map((course, index) => ({
    id: toSyntheticWebId(course.source_url ?? `${course.title}|${course.provider ?? ""}|${index}`),
    title: course.title,
    category: course.category ?? null,
    weapon_system: course.weapon_system ?? null,
    start_date: course.start_date ?? null,
    distance_miles: course.distance_miles ?? null,
    duration_days: course.duration_days ?? null,
    skill_level: course.skill_level ?? null,
    gear_requirements: course.gear_requirements ?? null
  }));
}

async function requestWebDiscoveryOnce(prompt: string, model: string, apiKey: string, timeoutMs: number): Promise<CourseRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search_preview" }],
        input: [
          {
            role: "system",
            content:
              "You discover firearms training course listings for search relevance only. Never provide instructional or tactical guidance."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return [];
    }

    const raw = (await response.json()) as unknown;
    const text = extractResponseText(raw);
    if (!text) {
      return [];
    }

    const parsed = parseWebDiscoveryText(text);
    if (!parsed) {
      return [];
    }

    return normalizeWebCourses(parsed.courses);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

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

export async function requestWebDiscoveredCourses(input: RecommendationRequest): Promise<CourseRecord[]> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return [];
  }

  const strictMatches = await requestWebDiscoveryOnce(
    buildWebSearchPrompt(input),
    env.OPENAI_MODEL,
    env.OPENAI_API_KEY,
    6000
  );

  if (strictMatches.length > 0) {
    return strictMatches;
  }

  const broadened = await requestWebDiscoveryOnce(
    buildBroadenedWebSearchPrompt(input),
    env.OPENAI_MODEL,
    env.OPENAI_API_KEY,
    6000
  );

  const deduped = new Map<string, CourseRecord>();
  for (const course of [...strictMatches, ...broadened]) {
    deduped.set(course.id, course);
  }
  return Array.from(deduped.values()).slice(0, 20);
}
