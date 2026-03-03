import { NextResponse } from "next/server";
import { createPublicSupabaseServerClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  type CourseRecord,
  RecommendationRequestSchema,
  RecommendationSchema,
  type RecommendationOutput
} from "@/lib/ai/schema";
import { rankCoursesDeterministically, recommendationCacheKey } from "@/lib/ranking/recommendations";
import { requestAIRecommendations, requestWebDiscoveredCourses } from "@/lib/ai/openai";
import { isAiRecommendationsEnabled, isWebDiscoveryEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

async function loadCourses(location: string, dateFrom: string, dateTo: string): Promise<CourseRecord[]> {
  const supabase = createPublicSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("courses")
    .select("id,title,category,weapon_system,start_date,distance_miles,duration_days,skill_level,gear_requirements")
    .limit(100);

  if (location) {
    query = query.ilike("location_label", `%${location}%`);
  }

  if (dateFrom) {
    query = query.gte("start_date", dateFrom);
  }

  if (dateTo) {
    query = query.lte("start_date", dateTo);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data as CourseRecord[];
}

async function getCachedRecommendation(cacheKey: string): Promise<RecommendationOutput | null> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("ai_recommendation_cache")
    .select("recommendation_json,created_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const created = new Date(data.created_at).getTime();
  const ageMs = Date.now() - created;
  if (ageMs > 1000 * 60 * 60 * 6) {
    return null;
  }

  const parsed = RecommendationSchema.safeParse(data.recommendation_json);
  if (!parsed.success) {
    return null;
  }

  // Avoid serving stale empty responses repeatedly; force fresh discovery attempts.
  if (parsed.data.suggested_course_ids.length === 0) {
    return null;
  }

  return parsed.data;
}

async function setCachedRecommendation(cacheKey: string, recommendation: RecommendationOutput): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) {
    return;
  }

  if (recommendation.suggested_course_ids.length === 0) {
    return;
  }

  await supabase.from("ai_recommendation_cache").upsert(
    {
      cache_key: cacheKey,
      recommendation_json: recommendation,
      created_at: new Date().toISOString()
    },
    { onConflict: "cache_key" }
  );
}

function withSuggestedCourseUrls(
  recommendation: RecommendationOutput,
  courses: CourseRecord[]
): RecommendationOutput {
  const lookup = new Map(courses.map((course) => [course.id, course.source_url ?? null]));
  return {
    ...recommendation,
    suggested_course_ids: recommendation.suggested_course_ids.map((id) => lookup.get(id) || id)
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsedInput = RecommendationRequestSchema.safeParse(body);

  if (!parsedInput.success) {
    return NextResponse.json(
      {
        suggested_course_ids: [],
        ranking_reasoning: ["Invalid request payload"],
        explanations: [],
        confidence_level: "low",
        missing_inputs: ["request_payload"],
        disclaimer:
          "Discovery assistance only. This platform does not provide firearms instruction, tactical guidance, legal advice, or weapon modification advice."
      },
      {
        status: 400,
        headers: {
          "x-debug-reason": "invalid_request_payload",
          "x-debug-source": "none",
          "x-debug-db-count": "0",
          "x-debug-web-count": "0",
          "x-debug-candidate-count": "0"
        }
      }
    );
  }

  const input = parsedInput.data;
  const dateFrom = input.dateFrom || input.date || "";
  const dateTo = input.dateTo || "";
  const dbCourses = await loadCourses(input.location, dateFrom, dateTo);
  const webCourses =
    dbCourses.length === 0 && isAiRecommendationsEnabled() && isWebDiscoveryEnabled()
      ? await requestWebDiscoveredCourses(input)
      : [];
  const courses = dbCourses.length > 0 ? dbCourses : webCourses;

  const deterministic = rankCoursesDeterministically(input, courses);
  const cacheKey = recommendationCacheKey(input, courses.map((c) => c.id));

  const cached = await getCachedRecommendation(cacheKey);
  if (cached) {
    return NextResponse.json(withSuggestedCourseUrls(cached, courses), {
      headers: {
        "x-debug-reason": "cache_hit",
        "x-debug-source": dbCourses.length > 0 ? "supabase" : webCourses.length > 0 ? "web_discovery" : "none",
        "x-debug-db-count": String(dbCourses.length),
        "x-debug-web-count": String(webCourses.length),
        "x-debug-candidate-count": String(courses.length)
      }
    });
  }

  const ai = isAiRecommendationsEnabled()
    ? await requestAIRecommendations(input, courses, deterministic)
    : null;
  const finalResult = RecommendationSchema.parse(ai ?? deterministic);
  const finalResponse = withSuggestedCourseUrls(finalResult, courses);

  await setCachedRecommendation(cacheKey, finalResult);
  return NextResponse.json(finalResponse, {
    headers: {
      "x-debug-reason":
        courses.length === 0
          ? "no_candidates_after_db_and_web_lookup"
          : ai
            ? "ai_ranked_candidates"
            : "deterministic_ranking_used",
      "x-debug-source": dbCourses.length > 0 ? "supabase" : webCourses.length > 0 ? "web_discovery" : "none",
      "x-debug-db-count": String(dbCourses.length),
      "x-debug-web-count": String(webCourses.length),
      "x-debug-candidate-count": String(courses.length)
    }
  });
}
