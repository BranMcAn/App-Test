import { z } from "zod";

const BooleanFlagSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["true", "false"])
);

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1).default("gpt-4.1-mini")
  ),
  AI_WEB_DISCOVERY_ENABLED: BooleanFlagSchema.default("true"),
  AI_RECOMMENDATIONS_ENABLED: BooleanFlagSchema.default("true")
});

export type ServerEnv = z.infer<typeof EnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = EnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    AI_WEB_DISCOVERY_ENABLED: process.env.AI_WEB_DISCOVERY_ENABLED,
    AI_RECOMMENDATIONS_ENABLED: process.env.AI_RECOMMENDATIONS_ENABLED
  });

  if (parsed.success) {
    return parsed.data;
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: "gpt-4.1-mini",
    AI_WEB_DISCOVERY_ENABLED: "true",
    AI_RECOMMENDATIONS_ENABLED: "true"
  };
}
