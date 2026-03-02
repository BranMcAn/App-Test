import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/instructor-assist/route";

describe("POST /api/instructor-assist", () => {
  it("returns structured assist data for valid payload", async () => {
    const req = new Request("http://localhost/api/instructor-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Precision Rifle 201",
        description: "A focused, multi-day precision rifle progression course.",
        weaponSystem: "Long Range / Precision Rifle",
        gearRequirements: "Bolt-action rifle, bipod, rear bag",
        durationDays: 2
      })
    });

    const res = await POST(req);
    const json = (await res.json()) as {
      clarity_gaps: string[];
      categorization_suggestions: string[];
      confidence_level: "low" | "medium" | "high";
      disclaimer: string;
    };

    expect(res.status).toBe(200);
    expect(Array.isArray(json.clarity_gaps)).toBe(true);
    expect(Array.isArray(json.categorization_suggestions)).toBe(true);
    expect(["low", "medium", "high"]).toContain(json.confidence_level);
    expect(typeof json.disclaimer).toBe("string");
  });

  it("returns 400 for invalid payload", async () => {
    const req = new Request("http://localhost/api/instructor-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationDays: "invalid" })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
