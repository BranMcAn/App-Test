import { RecommendationDisclaimer } from "@/lib/ai/schema";

export type InstructorAssistInput = {
  title?: string;
  description?: string;
  weaponSystem?: string;
  gearRequirements?: string;
  durationDays?: number;
};

export type InstructorAssistOutput = {
  clarity_gaps: string[];
  categorization_suggestions: string[];
  confidence_level: "low" | "medium" | "high";
  disclaimer: string;
};

export function deterministicInstructorAssist(input: InstructorAssistInput): InstructorAssistOutput {
  const gaps: string[] = [];
  const categories: string[] = [];

  if (!input.title?.trim()) gaps.push("Add a clear title that identifies course focus.");
  if (!input.description?.trim() || input.description.trim().length < 120) {
    gaps.push("Expand description with prerequisites, expected outcomes, and schedule detail.");
  }
  if (!input.weaponSystem?.trim()) {
    gaps.push("Specify weapon system so discovery filters work correctly.");
  }
  if (!input.gearRequirements?.trim()) {
    gaps.push("Add minimum gear requirements for attendee readiness.");
  }

  const ws = (input.weaponSystem ?? "").toLowerCase();
  if (ws.includes("long") || ws.includes("precision")) {
    categories.push("Consider category: Long Range / Precision Rifle");
    if ((input.durationDays ?? 0) < 2) {
      categories.push("If appropriate, clarify whether this is single-day intro or multi-day precision progression.");
    }
  }

  if (!categories.length) {
    categories.push("Validate category alignment with your selected weapon system.");
  }

  return {
    clarity_gaps: gaps,
    categorization_suggestions: categories,
    confidence_level: gaps.length <= 1 ? "high" : gaps.length <= 3 ? "medium" : "low",
    disclaimer: RecommendationDisclaimer
  };
}