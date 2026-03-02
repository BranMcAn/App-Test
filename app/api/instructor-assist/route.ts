import { NextResponse } from "next/server";
import { z } from "zod";
import { deterministicInstructorAssist } from "@/lib/ai/instructor";

const InstructorRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  weaponSystem: z.string().optional(),
  gearRequirements: z.string().optional(),
  durationDays: z.coerce.number().int().positive().optional()
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = InstructorRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        clarity_gaps: ["Invalid instructor payload"],
        categorization_suggestions: [],
        confidence_level: "low",
        disclaimer:
          "Discovery assistance only. This platform does not provide firearms instruction, tactical guidance, legal advice, or weapon modification advice."
      },
      { status: 400 }
    );
  }

  return NextResponse.json(deterministicInstructorAssist(parsed.data));
}