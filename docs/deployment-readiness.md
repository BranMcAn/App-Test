# Deployment Readiness

## Smoke test checklist

1. Home page loads and form renders.
2. Loading state appears during recommendation request.
3. Empty state appears when no course IDs are returned.
4. Error state appears on non-200 or network failure.
5. Successful state shows IDs, explanations, confidence, missing inputs, and disclaimer.
6. Recommendation API returns JSON with required keys only.
7. Instructor assist API returns deterministic clarity suggestions.

## Environment variable checklist

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `OPENAI_API_KEY`
5. `OPENAI_MODEL` (optional; defaults to `gpt-4.1-mini`)
6. `AI_RECOMMENDATIONS_ENABLED` (`true` or `false`)
7. `AI_WEB_DISCOVERY_ENABLED` (`true` or `false`)

## Supabase migration steps

1. Run SQL from `supabase/migrations/202603021245_add_ai_discovery_tables.sql`.
2. Confirm new tables exist:
   - `user_preference_signals`
   - `ai_recommendation_cache`
   - `instructor_ai_suggestion_drafts`
3. Confirm indexes created successfully.

## Vercel deployment verification

1. Build succeeds in Vercel logs.
2. Runtime env vars set in Project Settings.
3. `/api/recommendations` responds 200 for valid request.
4. Unset `OPENAI_API_KEY` and verify deterministic fallback still works.

## Rollback plan

1. Disable AI feature at routing layer by returning deterministic output only.
2. Revert application commits.
3. Optionally keep additive tables unused (no destructive rollback required).
