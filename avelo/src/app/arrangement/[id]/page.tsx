"use client";

/**
 * Arrangement Details screen (Tasks 3.12, 6.5): booking reference,
 * fictional provider, vehicle/accessibility equipment, passenger/
 * companion details, both legs with times, price/status, and "Request a
 * Different Arrangement". While a replacement search is in progress, the
 * originally confirmed provider/price remain visible (Requirement 81).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReplacementRequestDialog } from "@/components/booking/ReplacementRequestDialog";
import { formatHHMMTo12Hour } from "@/domain/pickupTimeCalculator";
import type { BookingFormData, BookingStatus, ProviderInfo } from "@/domain/types";

interface ArrangementData {
  bookingId: string;
  status: BookingStatus;
  provider?: ProviderInfo;
  confirmedProvider?: ProviderInfo;
  confirmedTotal?: number;
  form: BookingFormData;
  replacement?: { reason: string };
}

const REPLACEMENT_IN_PROGRESS: BookingStatus[] = [
  "ReplacementRequested",
  "ReplacementSearching",
  "ReplacementFound",
  "ReplacementAcceptedSamePrice",
  "ReplacementProposedRevision",
];

export default function ArrangementDetailsPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ArrangementData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const fetchBooking = useCallback(async () => {
    const response = await fetch(`/api/booking/${params.id}`);
    if (response.ok) setData(await response.json());
  }, [params.id]);

  useEffect(() => {
    // Initial fetch + poll against a real external system (the booking
    // API), not a value derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBooking();
    pollRef.current = setInterval(fetchBooking, 1200);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchBooking]);

  async function handleReplace(reason: string) {
    const response = await fetch(`/api/booking/${params.id}/replace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? "Request failed.");
    }
    setDialogOpen(false);
    void fetchBooking();
  }

  if (!data) {
    return (
      <Card>
        <p role="status">Loading your arrangement...</p>
      </Card>
    );
  }

  const form = data.form;
  const replacementInProgress = REPLACEMENT_IN_PROGRESS.includes(data.status);
  const provider = data.confirmedProvider ?? data.provider;
  const total = data.confirmedTotal;

  return (
    <div>
      <Card>
        <h1 style={{ fontSize: "var(--text-xxl)", color: "var(--color-primary)", marginBottom: "4px" }}>
          Arrangement Details
        </h1>
        <p style={{ fontSize: "var(--text-sm)", opacity: 0.85, marginBottom: "var(--space-md)" }}>
          Provider matching in this demo is simulated.
        </p>
        <p style={{ marginBottom: "var(--space-md)" }}>
          Booking reference: <strong>{data.bookingId}</strong>
        </p>

        {replacementInProgress && (
          <p role="status" style={{ marginBottom: "var(--space-md)", fontStyle: "italic" }}>
            We&apos;re arranging a replacement. Your original confirmed arrangement below stays in place until the
            replacement is finalized.
          </p>
        )}

        {provider && (
          <section style={{ marginBottom: "var(--space-lg)" }}>
            <h2 style={{ fontSize: "var(--text-lg)" }}>Provider</h2>
            <p>{provider.name}</p>
            <p>{provider.vehicleType}</p>
            <p>Accessibility equipment: {provider.accessibilityEquipment.join(", ")}</p>
          </section>
        )}

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Passenger &amp; Companions</h2>
          <p>Passenger: {form.passenger.name}</p>
          <p>Companions: {form.requirements.companionCount}</p>
          {form.requirements.specialRequests.trim() && <p>Special requests: {form.requirements.specialRequests}</p>}
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Outbound Trip</h2>
          <p>{form.outbound.pickupAddress} &rarr; {form.outbound.destinationName}</p>
          <p>Required arrival: {formatHHMMTo12Hour(form.outbound.requiredArrivalTime)}</p>
          {form.outbound.suggestedPickupTime && <p>Pickup: {formatHHMMTo12Hour(form.outbound.suggestedPickupTime)}</p>}
          <p>Date: {form.outbound.tripDate}</p>
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Return Trip</h2>
          <p>
            {form.return.originAddress || form.outbound.destinationAddress} &rarr;{" "}
            {form.return.destinationAddress || form.outbound.pickupAddress}
          </p>
          <p>Pickup: {formatHHMMTo12Hour(form.return.pickupTime)}</p>
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Price &amp; Status</h2>
          {typeof total === "number" && <p style={{ fontWeight: 700 }}>Total: ${total.toFixed(2)}</p>}
          <p>Status: Booking Confirmed</p>
        </section>

        <Button type="button" ref={triggerRef} onClick={() => setDialogOpen(true)} disabled={data.status !== "Confirmed" && data.status !== "ReplacementConfirmed"}>
          Request a Different Arrangement
        </Button>
      </Card>

      <ReplacementRequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleReplace} triggerRef={triggerRef} />
    </div>
  );
}
