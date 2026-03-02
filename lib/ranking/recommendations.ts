import { createHash } from "crypto";
import type { RecommendationRequest, CourseRecord, RecommendationOutput } from "@/lib/ai/schema";
import { RecommendationDisclaimer } from "@/lib/ai/schema";

type RankedCourse = {
  course: CourseRecord;
  score: number;
  reasons: string[];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function isLongRangeText(value: string | null | undefined): boolean {
  const v = normalizeText(value);
  return v.includes("long range") || v.includes("precision") || v.includes("pr") || v.includes("sniper");
}

function weaponMatch(selectedWeaponSystem: string, course: CourseRecord): { matched: boolean; longRangeFocus: boolean } {
  const requested = normalizeText(selectedWeaponSystem);
  const courseWeapon = normalizeText(course.weapon_system);
  const courseCategory = normalizeText(course.category);
  const longRangeCourse = isLongRangeText(courseWeapon) || isLongRangeText(courseCategory) || isLongRangeText(course.title);

  if (!requested) {
    return { matched: true, longRangeFocus: longRangeCourse };
  }

  const requestedLongRange = isLongRangeText(requested);
  if (requestedLongRange) {
    return { matched: longRangeCourse, longRangeFocus: longRangeCourse };
  }

  return {
    matched: requested === courseWeapon || normalizeText(course.title).includes(requested) || courseCategory.includes(requested),
    longRangeFocus: longRangeCourse
  };
}

function dateIsUpcomingWeekend(startDate: string | null): boolean {
  if (!startDate) {
    return false;
  }

  const date = new Date(startDate);
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function skillLevelMatch(input: string, courseSkill: string | null): boolean {
  const selected = normalizeText(input);
  if (!selected) {
    return true;
  }
  return normalizeText(courseSkill) === selected;
}

export function rankCoursesDeterministically(
  input: RecommendationRequest,
  courses: CourseRecord[]
): RecommendationOutput {
  const ranked: RankedCourse[] = courses
    .map((course) => {
      let score = 0;
      const reasons: string[] = [];

      const weapon = weaponMatch(input.weaponSystem, course);
      if (!weapon.matched) {
        return { course, score: -1, reasons: ["Weapon system mismatch"] };
      }

      score += 40;
      if (weapon.longRangeFocus && isLongRangeText(input.weaponSystem)) {
        score += 20;
        reasons.push("Matches your Long Range or Precision Rifle preference");

        if ((course.duration_days ?? 0) >= 2) {
          score += 10;
          reasons.push("Prioritizes multi-day precision format");
        }
      } else if (input.weaponSystem) {
        reasons.push("Matches your weapon system preference");
      }

      if (input.distanceMiles && course.distance_miles !== null && course.distance_miles <= input.distanceMiles) {
        score += 15;
        reasons.push(`Within ${input.distanceMiles} miles`);
      }

      if (input.date && course.start_date && course.start_date >= input.date) {
        score += 10;
      }

      if (dateIsUpcomingWeekend(course.start_date)) {
        score += 8;
        reasons.push("Upcoming weekend availability");
      }

      if (skillLevelMatch(input.skillLevel, course.skill_level)) {
        score += 12;
        if (input.skillLevel) {
          reasons.push("Aligned with selected skill level");
        }
      }

      if (input.gearConstraints) {
        const required = normalizeText(course.gear_requirements);
        const userGear = normalizeText(input.gearConstraints);
        if (!required || required.includes(userGear)) {
          score += 6;
          reasons.push("Compatible with your gear constraints");
        }
      }

      if (!reasons.length) {
        reasons.push("Closest deterministic match to your selected filters");
      }

      return { course, score, reasons };
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const missingInputs: string[] = [];
  if (!input.location) missingInputs.push("location");
  if (!input.weaponSystem) missingInputs.push("weaponSystem");
  if (!input.date) missingInputs.push("date");
  if (!input.distanceMiles) missingInputs.push("distanceMiles");
  if (!input.skillLevel) missingInputs.push("skillLevel");
  if (!input.gearConstraints) missingInputs.push("gearConstraints");

  return {
    suggested_course_ids: ranked.map((r) => r.course.id),
    ranking_reasoning: ranked.map((r) => `${r.course.id}: score=${r.score}`),
    explanations: ranked.flatMap((r) => r.reasons).slice(0, 8),
    confidence_level: ranked.length >= 5 ? "high" : ranked.length >= 2 ? "medium" : "low",
    missing_inputs: missingInputs,
    disclaimer: RecommendationDisclaimer
  };
}

export function recommendationCacheKey(input: RecommendationRequest, courseIds: string[]): string {
  const hashInput = JSON.stringify({ input, courseIds: courseIds.slice().sort() });
  return createHash("sha256").update(hashInput).digest("hex");
}