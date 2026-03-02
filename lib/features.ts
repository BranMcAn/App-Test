import { getServerEnv } from "@/lib/env";

export function isAiRecommendationsEnabled(): boolean {
  return getServerEnv().AI_RECOMMENDATIONS_ENABLED === "true";
}

export function isWebDiscoveryEnabled(): boolean {
  return getServerEnv().AI_WEB_DISCOVERY_ENABLED === "true";
}
