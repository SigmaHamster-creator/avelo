import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { applyEvent, getBooking } from "@/server/bookingStore";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = getBooking(id);
  if (!booking) return apiError(404, "NOT_FOUND", "No booking exists with that reference.");

  const event = booking.status === "ProviderProposedRevision" ? "acceptNewPrice" : "acceptReplacementPrice";
  const updated = applyEvent(id, event, (b) => ({
    ...b,
    confirmedProvider: b.provider,
    confirmedTotal: b.revisedEstimate?.total ?? b.originalEstimate.total,
  }));
  if (!updated) {
    return apiError(409, "INVALID_STATE_TRANSITION", "This booking is not currently awaiting a price decision.");
  }

  return NextResponse.json({
    bookingId: updated.bookingId,
    status: updated.status,
    originalEstimate: updated.originalEstimate,
    revisedEstimate: updated.revisedEstimate,
    provider: updated.provider,
    confirmedProvider: updated.confirmedProvider,
    confirmedTotal: updated.confirmedTotal,
    form: updated.form,
  });
}
