import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { SCENARIOS } from "@/domain/demoScenarios";
import type { DemoScenarioId } from "@/domain/types";

export async function POST(request: NextRequest) {
  let body: { scenario?: DemoScenarioId };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_FAILED", "Request body must be valid JSON.");
  }

  const scenario = body.scenario;
  if (!scenario || !SCENARIOS[scenario]) {
    return apiError(400, "VALIDATION_FAILED", "Unknown demo scenario id.");
  }

  const fixture = SCENARIOS[scenario];
  return NextResponse.json({ scenarioId: fixture.id, form: fixture.form });
}
