import { getServerEnv } from "@/lib/env";

export function isAiRecommendationsEnabled(): boolean {
  return getServerEnv().AI_RECOMMENDATIONS_ENABLED === "true";
}
