import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { applyEvent, getBooking } from "@/server/bookingStore";
import { resumePrimarySearch, resumeReplacementSearch } from "@/server/matchingScheduler";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = getBooking(id);
  if (!booking) return apiError(404, "NOT_FOUND", "No booking exists with that reference.");

  const isReplacement = booking.status === "ReplacementProposedRevision";
  const event = isReplacement ? "findAnotherReplacement" : "findAnother";
  const updated = applyEvent(id, event);
  if (!updated) {
    return apiError(409, "INVALID_STATE_TRANSITION", "This booking is not currently awaiting a price decision.");
  }

  if (isReplacement) {
    resumeReplacementSearch(id);
  } else {
    resumePrimarySearch(id);
  }

  return NextResponse.json({
    bookingId: updated.bookingId,
    status: updated.status,
    originalEstimate: updated.originalEstimate,
    revisedEstimate: updated.revisedEstimate,
    provider: updated.provider,
    form: updated.form,
  });
}
