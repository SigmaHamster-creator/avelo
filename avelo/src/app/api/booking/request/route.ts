/**
 * POST /api/booking/request (Task 3.8): the single point at which the
 * caregiver authorizes the arrangement at the displayed estimate.
 * Re-validates the form and re-computes the estimate server-side so a
 * stale client-side estimate can never be silently honored.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { computeEstimate } from "@/server/estimation";
import { validateForm } from "@/domain/formValidator";
import { createBooking, applyEvent, hasClientRequestId } from "@/server/bookingStore";
import { startPrimarySearch } from "@/server/matchingScheduler";
import type { BookingFormData, DemoScenarioId, EstimateResult } from "@/domain/types";
import { DEFAULT_SCENARIO_ID, SCENARIOS } from "@/domain/demoScenarios";

interface BookingRequestBody {
  form?: BookingFormData;
  acceptedEstimate?: EstimateResult;
  scenarioId?: DemoScenarioId;
  clientRequestId?: string;
}

export async function POST(request: NextRequest) {
  let body: BookingRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_FAILED", "Request body must be valid JSON.");
  }

  const { form, acceptedEstimate, clientRequestId } = body;
  if (!form || !acceptedEstimate) {
    return apiError(400, "VALIDATION_FAILED", "form and acceptedEstimate are required.");
  }

  const errors = validateForm(form);
  if (errors.length > 0) {
    return apiError(400, "VALIDATION_FAILED", "The form contains invalid or missing fields.", errors);
  }

  const freshEstimate = computeEstimate(form);
  if ("error" in freshEstimate) {
    return apiError(400, "OUT_OF_BOUNDS", freshEstimate.message);
  }
  if (Math.abs(freshEstimate.total - acceptedEstimate.total) > 0.005) {
    return apiError(
      400,
      "STALE_ESTIMATE",
      "Your trip details changed since the estimate was shown. Please review the updated estimate before requesting the arrangement.",
    );
  }

  if (clientRequestId && hasClientRequestId(clientRequestId)) {
    return apiError(409, "DUPLICATE_REQUEST", "This arrangement request has already been submitted.");
  }

  const scenarioId: DemoScenarioId = body.scenarioId && SCENARIOS[body.scenarioId] ? body.scenarioId : DEFAULT_SCENARIO_ID;

  // Store the server-calculated pickup time with the booking so the
  // arrangement shows both legs' times.
  const bookedForm: BookingFormData = {
    ...form,
    outbound: { ...form.outbound, suggestedPickupTime: freshEstimate.suggestedPickupTime },
  };
  const booking = createBooking(bookedForm, freshEstimate, scenarioId, clientRequestId);
  applyEvent(booking.bookingId, "startSearching");
  startPrimarySearch(booking.bookingId);

  return NextResponse.json({ bookingId: booking.bookingId, status: "Searching" });
}
