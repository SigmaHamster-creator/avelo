import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { applyEvent, getBooking } from "@/server/bookingStore";
import { startReplacementSearch } from "@/server/matchingScheduler";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_FAILED", "Request body must be valid JSON.");
  }

  const reason = (body.reason ?? "").trim();
  if (!reason) {
    return apiError(400, "VALIDATION_FAILED", "Please describe why you'd like a different arrangement.");
  }

  const booking = getBooking(id);
  if (!booking) return apiError(404, "NOT_FOUND", "No booking exists with that reference.");

  const updated = applyEvent(id, "requestReplacement", (b) => ({ ...b, replacement: { reason } }));
  if (!updated) {
    return apiError(409, "INVALID_STATE_TRANSITION", "Only a confirmed booking can be replaced.");
  }

  applyEvent(id, "startSearching");
  startReplacementSearch(id);

  return NextResponse.json({ bookingId: id, status: "ReplacementSearching" });
}
