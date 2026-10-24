"use client";

/**
 * Estimate & Review screen (Tasks 2.8-2.13, 3.10): shows passenger/caregiver
 * info, both legs, required arrival + suggested pickup time, requirements,
 * the price breakdown, the special-request notice, the no-real-payment
 * reassurance, "Edit", and "Request Arrangement". Refuses to display a
 * stale estimate -- it refetches automatically first (Requirement 71).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBooking } from "@/components/booking/BookingProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatHHMMTo12Hour } from "@/domain/pickupTimeCalculator";

function randomRequestId(): string {
  return `req-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export default function ReviewPage() {
  const router = useRouter();
  const { state, errors, setEstimate, setBookingId } = useBooking();
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const clientRequestIdRef = useRef<string>(randomRequestId());

  const refetchEstimate = useCallback(async () => {
    setRefreshing(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: state.form }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setSubmitError(body?.error?.message ?? "We couldn't calculate an estimate.");
        return;
      }
      const estimate = await response.json();
      setEstimate(estimate);
    } catch {
      setSubmitError("We couldn't reach the server. Please check your connection.");
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.form]);

  useEffect(() => {
    if (errors.length > 0) {
      router.replace("/booking");
      return;
    }
    if (!state.estimate || state.estimateStale) {
      // Refetching from the server is a genuine external-system call
      // (POST /api/estimate), not a value derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refetchEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.estimateStale, state.estimate, errors.length]);

  async function handleRequestArrangement() {
    if (!state.estimate || state.estimateStale) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/booking/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: state.form,
          acceptedEstimate: state.estimate,
          scenarioId: state.scenarioId,
          clientRequestId: clientRequestIdRef.current,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setSubmitError(body?.error?.message ?? "We couldn't submit your request. Please try again.");
        setSubmitting(false);
        return;
      }
      setBookingId(body.bookingId);
      router.push(`/status/${body.bookingId}`);
    } catch {
      setSubmitError("We couldn't reach the server. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const form = state.form;
  const specialRequests = form.requirements.specialRequests.trim();

  return (
    <div>
      <Card>
        <h1 style={{ fontSize: "var(--text-xxl)", color: "var(--color-primary)", marginBottom: "var(--space-md)" }}>
          Estimate &amp; Review
        </h1>

        {submitError && (
          <p role="alert" style={{ color: "var(--color-error)", marginBottom: "var(--space-md)" }}>
            ⚠ {submitError}
          </p>
        )}

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Caregiver &amp; Passenger</h2>
          <p>{form.caregiver.name} ({form.caregiver.phone})</p>
          <p>Passenger: {form.passenger.name}</p>
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Outbound Trip</h2>
          <p>Pickup: {form.outbound.pickupAddress}</p>
          <p>Destination: {form.outbound.destinationName} ({form.outbound.destinationAddress})</p>
          <p>Date: {form.outbound.tripDate}</p>
          <p>Required arrival: {formatHHMMTo12Hour(form.outbound.requiredArrivalTime)}</p>
          {refreshing ? (
            <p role="status">Calculating the suggested pickup time...</p>
          ) : state.estimate ? (
            <p>{state.estimate.explanation}</p>
          ) : null}
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Return Trip</h2>
          <p>Return pickup time: {formatHHMMTo12Hour(form.return.pickupTime)}</p>
          <p>From: {form.return.originAddress || form.outbound.destinationAddress}</p>
          <p>To: {form.return.destinationAddress || form.outbound.pickupAddress}</p>
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Mobility &amp; Assistance</h2>
          <p>
            {form.requirements.mobility === "must-remain-in-wheelchair"
              ? "Passenger must remain in their wheelchair"
              : "Passenger can transfer to a vehicle seat"}
          </p>
          <p>Companions: {form.requirements.companionCount}</p>
          {specialRequests && <p>Special requests: {specialRequests}</p>}
        </section>

        <section style={{ marginBottom: "var(--space-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>Price Estimate</h2>
          {refreshing && <p role="status">Calculating your estimate...</p>}
          {!refreshing && state.estimate && (
            <>
              <p>Outbound: ${state.estimate.outboundEstimate.toFixed(2)}</p>
              <p>Return: ${state.estimate.returnEstimate.toFixed(2)}</p>
              <p style={{ fontWeight: 700 }}>Round-trip total: ${state.estimate.total.toFixed(2)}</p>
              {specialRequests && (
                <p role="note" style={{ fontSize: "var(--text-sm)", marginTop: "8px" }}>
                  This estimate may not include additional costs for special requests. We will confirm these with
                  the provider. If the price changes, we will notify you and ask for your approval before
                  confirming the booking.
                </p>
              )}
              <p style={{ fontSize: "var(--text-sm)", marginTop: "8px", opacity: 0.85 }}>
                No real payment is collected at any point in this demo.
              </p>
            </>
          )}
        </section>

        <div style={{ display: "flex", gap: "var(--space-md)" }}>
          <Button type="button" variant="secondary" onClick={() => router.push("/booking")}>
            Edit
          </Button>
          <Button
            type="button"
            onClick={handleRequestArrangement}
            loading={submitting}
            disabled={!state.estimate || state.estimateStale || refreshing}
          >
            Request Arrangement
          </Button>
        </div>
      </Card>
    </div>
  );
}
