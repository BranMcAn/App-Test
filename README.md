# Firearms Training Discovery

Production-safe baseline for AI-powered course discovery with deterministic fallback.

## Run

```bash
npm install
npm run dev
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm run build
```

## Safety boundaries

- Discovery only, no firearms instruction.
- AI output is structured JSON and validated.
- AI failures fall back to deterministic ranking.
- Long Range / Precision Rifle is handled as a first-class category.

## Database migration

Apply:

- `supabase/migrations/202603021245_add_ai_discovery_tables.sql`

No destructive migration operations are included.

## Feature flags

- `AI_RECOMMENDATIONS_ENABLED=true` enables OpenAI ranking.
- Set `AI_RECOMMENDATIONS_ENABLED=false` to force deterministic ranking only.
