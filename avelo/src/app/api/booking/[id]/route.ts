import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/apiError";
import { getBooking } from "@/server/bookingStore";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = getBooking(id);
  if (!booking) {
    return apiError(404, "NOT_FOUND", "No booking exists with that reference.");
  }

  return NextResponse.json({
    bookingId: booking.bookingId,
    status: booking.status,
    originalEstimate: booking.originalEstimate,
    revisedEstimate: booking.revisedEstimate,
    provider: booking.provider,
    confirmedProvider: booking.confirmedProvider,
    confirmedTotal: booking.confirmedTotal,
    replacement: booking.replacement,
    form: booking.form,
  });
}
