import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { computeEstimate } from "@/server/estimation";
import type { BookingFormData } from "@/domain/types";

export async function POST(request: NextRequest) {
  let body: { form?: BookingFormData };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_FAILED", "Request body must be valid JSON.");
  }

  const form = body.form;
  if (!form || typeof form !== "object") {
    return apiError(400, "VALIDATION_FAILED", "A form object is required.");
  }

  const result = computeEstimate(form);
  if ("error" in result) {
    return apiError(400, "OUT_OF_BOUNDS", result.message);
  }

  return NextResponse.json(result);
}
