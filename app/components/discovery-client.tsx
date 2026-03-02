"use client";

import { useMemo, useState } from "react";

type RecommendationResponse = {
  suggested_course_ids: string[];
  ranking_reasoning: string[];
  explanations: string[];
  confidence_level: "low" | "medium" | "high";
  missing_inputs: string[];
  disclaimer: string;
};

const defaultResponse: RecommendationResponse = {
  suggested_course_ids: [],
  ranking_reasoning: [],
  explanations: [],
  confidence_level: "low",
  missing_inputs: [],
  disclaimer:
    "Discovery assistance only. This platform does not provide firearms instruction, tactical guidance, legal advice, or weapon modification advice."
};

export function DiscoveryClient() {
  const [location, setLocation] = useState("");
  const [weaponSystem, setWeaponSystem] = useState("Long Range / Precision Rifle");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [distanceMiles, setDistanceMiles] = useState(50);
  const [skillLevel, setSkillLevel] = useState("Intermediate");
  const [gearConstraints, setGearConstraints] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  const state = useMemo(() => {
    if (loading) return "loading";
    if (error) return "error";
    if (!result) return "idle";
    if (!result.suggested_course_ids.length) return "empty";
    return "success";
  }, [error, loading, result]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          weaponSystem,
          dateFrom,
          dateTo,
          distanceMiles,
          skillLevel,
          gearConstraints
        })
      });

      const data = (await response.json().catch(() => null)) as RecommendationResponse | null;
      if (!data) {
        setResult(defaultResponse);
        setError("No response payload received.");
        return;
      }

      setResult(data);
      if (!response.ok) {
        setError("Recommendations returned a validation error. Showing fallback data.");
      }
    } catch {
      setResult(defaultResponse);
      setError("Recommendations are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card" aria-live="polite">
      <form onSubmit={onSubmit}>
        <div className="grid">
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or region" />
          </label>

          <label>
            Weapon System
            <select value={weaponSystem} onChange={(e) => setWeaponSystem(e.target.value)}>
              <option>Long Range / Precision Rifle</option>
              <option>Carbine Rifle</option>
              <option>Handgun</option>
              <option>Shotgun</option>
            </select>
          </label>

          <label>
            Start Date
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label>
            End Date
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>

          <label>
            Max Distance (miles)
            <input
              type="number"
              min={1}
              value={distanceMiles}
              onChange={(e) => setDistanceMiles(Number(e.target.value) || 0)}
            />
          </label>

          <label>
            Skill Level
            <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </label>

          <label>
            Gear Constraints
            <input
              value={gearConstraints}
              onChange={(e) => setGearConstraints(e.target.value)}
              placeholder="Example: Bolt-action only"
            />
          </label>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Finding Matches..." : "Find Courses"}
          </button>
        </div>
      </form>

      {state === "idle" ? <p className="state">Submit filters to get personalized suggestions.</p> : null}
      {state === "loading" ? <p className="state">Loading recommendations...</p> : null}
      {state === "error" ? <p className="state">{error}</p> : null}
      {state === "empty" ? (
        <p className="state">No matching courses found. Try widening date or distance filters.</p>
      ) : null}

      {state === "success" && result ? (
        <div className="state">
          <h2 style={{ marginTop: 0 }}>Suggested Course IDs</h2>
          <ul>
            {result.suggested_course_ids.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <h3>Why these courses</h3>
          <ul>
            {result.explanations.map((explanation, idx) => (
              <li key={`${explanation}-${idx}`}>{explanation}</li>
            ))}
          </ul>
          <p>Confidence: {result.confidence_level}</p>
          <p>Missing Inputs: {result.missing_inputs.join(", ") || "None"}</p>
          <p>{result.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
