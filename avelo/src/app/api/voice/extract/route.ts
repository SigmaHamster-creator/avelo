/**
 * POST /api/voice/extract (Task 4.16): transcript -> field patch.
 *
 * Selects the deterministic-fallback extractor by default; a real
 * provider would be selected server-side only via AI_EXTRACTION_PROVIDER.
 * No secret is ever present in this route's request/response payloads.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { getActiveExtractor, validateExtractedPatch } from "@/domain/voiceExtractionAdapter";
import type { BookingFormData } from "@/domain/types";

const EXTRACTION_TIMEOUT_MS = 8000;

interface VoiceExtractRequestBody {
  transcript?: string;
  currentFormSnapshot?: BookingFormData;
  nowISO?: string;
  formEditVersion?: number;
}

export async function POST(request: NextRequest) {
  let body: VoiceExtractRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_FAILED", "Request body must be valid JSON.");
  }

  if (typeof body.transcript !== "string" || !body.currentFormSnapshot) {
    return apiError(400, "VALIDATION_FAILED", "transcript and currentFormSnapshot are required.");
  }

  const { adapter, source } = getActiveExtractor();
  const nowISO = body.nowISO ?? new Date().toISOString();

  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("ai-timeout")), EXTRACTION_TIMEOUT_MS);
    });
    const result = await Promise.race([
      adapter.extract({ transcript: body.transcript, currentFormSnapshot: body.currentFormSnapshot, nowISO }),
      timeout,
    ]);

    // Server-side validation: never let a malformed or partially-valid
    // extractor response reach the form (Requirement 95 / Property 17).
    const patch = typeof result === "object" && result !== null ? validateExtractedPatch(result.patch) : null;
    if (!patch) {
      return apiError(422, "INVALID_EXTRACTION", "The extractor returned an invalid response.");
    }

    return NextResponse.json({
      patch,
      resolvedLeg: result.resolvedLeg,
      clarificationNeeded: result.clarificationNeeded,
      note: result.note,
      resolvedRelativeDate: result.resolvedRelativeDate,
      confidence: result.confidence,
      source,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ai-timeout") {
      return apiError(422, "INVALID_EXTRACTION", "The voice extraction request timed out. Please try again.");
    }
    return apiError(500, "UNEXPECTED_ERROR", "Voice extraction failed unexpectedly.");
  }
}
