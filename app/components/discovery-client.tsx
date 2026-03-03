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

type DebugInfo = {
  reason: string;
  source: string;
  dbCount: string;
  webCount: string;
  candidateCount: string;
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
  const [weaponSystem, setWeaponSystem] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [distanceMiles, setDistanceMiles] = useState(50);
  const [skillLevel, setSkillLevel] = useState("");
  const [gearConstraints, setGearConstraints] = useState("");
  const [anyDates, setAnyDates] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [debug, setDebug] = useState<DebugInfo | null>(null);

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
          dateFrom: anyDates ? "" : dateFrom,
          dateTo: anyDates ? "" : dateTo,
          distanceMiles,
          skillLevel,
          gearConstraints
        })
      });

      const data = (await response.json().catch(() => null)) as RecommendationResponse | null;
      setDebug({
        reason: response.headers.get("x-debug-reason") ?? "unavailable",
        source: response.headers.get("x-debug-source") ?? "unknown",
        dbCount: response.headers.get("x-debug-db-count") ?? "0",
        webCount: response.headers.get("x-debug-web-count") ?? "0",
        candidateCount: response.headers.get("x-debug-candidate-count") ?? "0"
      });
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
      setDebug({
        reason: "request_exception",
        source: "unknown",
        dbCount: "0",
        webCount: "0",
        candidateCount: "0"
      });
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
              <option value="">Any Category</option>
              <option>Long Range / Precision Rifle</option>
              <option>Carbine Rifle</option>
              <option>Handgun</option>
              <option>Shotgun</option>
            </select>
          </label>

          <label>
            Start Date
            <input
              type="date"
              value={dateFrom}
              disabled={anyDates}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          <label>
            End Date
            <input type="date" value={dateTo} disabled={anyDates} onChange={(e) => setDateTo(e.target.value)} />
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
              <option value="">Any Category</option>
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

        <div style={{ marginTop: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={anyDates}
              onChange={(e) => {
                const checked = e.target.checked;
                setAnyDates(checked);
                if (checked) {
                  setDateFrom("");
                  setDateTo("");
                }
              }}
            />
            Any Dates
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

      {debug ? (
        <div className="state">
          <strong>Debug Reason</strong>
          <p style={{ margin: "0.5rem 0 0 0" }}>Reason: {debug.reason}</p>
          <p style={{ margin: "0.25rem 0 0 0" }}>Source: {debug.source}</p>
          <p style={{ margin: "0.25rem 0 0 0" }}>
            DB Candidates: {debug.dbCount} | Web Candidates: {debug.webCount} | Total Candidates:{" "}
            {debug.candidateCount}
          </p>
        </div>
      ) : null}
    </section>
  );
}
