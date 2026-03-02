import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/recommendations/route";

function requiredKeys(payload: Record<string, unknown>): boolean {
  const keys = [
    "suggested_course_ids",
    "ranking_reasoning",
    "explanations",
    "confidence_level",
    "missing_inputs",
    "disclaimer"
  ];
  return keys.every((key) => key in payload);
}

describe("POST /api/recommendations", () => {
  it("returns required JSON shape for valid request", async () => {
    const req = new Request("http://localhost/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "Dallas",
        weaponSystem: "Long Range / Precision Rifle",
        date: "2026-03-14",
        distanceMiles: 50,
        skillLevel: "Intermediate",
        gearConstraints: "Bolt-action"
      })
    });

    const res = await POST(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(requiredKeys(json)).toBe(true);
  });

  it("returns 400 and required shape for invalid payload", async () => {
    const req = new Request("http://localhost/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distanceMiles: "not-a-number" })
    });

    const res = await POST(req);
    const json = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(requiredKeys(json)).toBe(true);
  });
});
