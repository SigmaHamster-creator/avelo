/**
 * POST /api/demo/reset (Task 7.3 + 7.4): tears down any booking and its
 * pending matching timers so a late scheduled response can never surface
 * in a subsequent session (AC-DEMO-01). The client is responsible for
 * clearing its own React form/transcript/error state and discarding any
 * in-flight fetch results (via a local request-epoch guard) on reset --
 * see DemoControlsPanel.
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteBooking } from "@/server/bookingStore";

export async function POST(request: NextRequest) {
  let body: { bookingId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine -- reset with no active booking.
  }

  if (body.bookingId) {
    deleteBooking(body.bookingId);
  }

  return NextResponse.json({ ok: true });
}
