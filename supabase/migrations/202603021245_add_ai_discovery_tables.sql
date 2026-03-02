create extension if not exists "pgcrypto";

create table if not exists public.user_preference_signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null,
  location text,
  weapon_system text,
  preferred_date date,
  distance_miles integer,
  skill_level text,
  gear_constraints text
);

create index if not exists idx_user_preference_signals_session_id
  on public.user_preference_signals (session_id);

create table if not exists public.ai_recommendation_cache (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cache_key text not null unique,
  recommendation_json jsonb not null
);

create index if not exists idx_ai_recommendation_cache_created_at
  on public.ai_recommendation_cache (created_at desc);

create table if not exists public.instructor_ai_suggestion_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  course_id text not null,
  suggestion_json jsonb not null,
  reviewer_acknowledged boolean not null default false
);

create index if not exists idx_instructor_ai_suggestion_drafts_course_id
  on public.instructor_ai_suggestion_drafts (course_id);