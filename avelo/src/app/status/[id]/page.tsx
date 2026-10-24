"use client";

/**
 * Booking Status screen (Tasks 3.11, 5.5): polls GET /api/booking/:id and
 * renders one of the five caregiver-facing labels with state-specific
 * actions. A candidate match alone is never shown as confirmed
 * (Requirement 73). Auto-advances to Arrangement Details once Confirmed.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBooking } from "@/components/booking/BookingProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { STATUS_LABELS, type BookingStatus, type EstimateResult, type ProviderInfo, type RevisedPriceInfo } from "@/domain/types";

interface BookingStatusResponse {
  bookingId: string;
  status: BookingStatus;
  originalEstimate: EstimateResult;
  revisedEstimate?: RevisedPriceInfo;
  provider?: ProviderInfo;
}

export default function BookingStatusPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { requestEpochRef } = useBooking();
  const [data, setData] = useState<BookingStatusResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<"accept" | "find-another" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const localEpoch = requestEpochRef.current;

    async function poll() {
      try {
        const response = await fetch(`/api/booking/${params.id}`);
        if (requestEpochRef.current !== localEpoch) return;
        if (!response.ok) return;
        const body = (await response.json()) as BookingStatusResponse;
        setData(body);

        if (body.status === "Confirmed" || body.status === "ReplacementConfirmed") {
          if (pollRef.current) clearInterval(pollRef.current);
          router.push(`/arrangement/${params.id}`);
        } else if (body.status === "UnableToArrange") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Transient network errors during polling are silently retried.
      }
    }

    void poll();
    pollRef.current = setInterval(poll, 1200);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleAcceptPrice() {
    setActionLoading("accept");
    setActionError(null);
    try {
      const response = await fetch(`/api/booking/${params.id}/accept-price`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setActionError(body?.error?.message ?? "Please try again.");
        return;
      }
      setData(body);
      if (body.status === "Confirmed" || body.status === "ReplacementConfirmed") {
        router.push(`/arrangement/${params.id}`);
      }
    } catch {
      setActionError("We couldn't reach the server. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFindAnother() {
    setActionLoading("find-another");
    setActionError(null);
    try {
      const response = await fetch(`/api/booking/${params.id}/find-another`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setActionError(body?.error?.message ?? "Please try again.");
        return;
      }
      setData(body);
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/booking/${params.id}`);
        if (r.ok) setData(await r.json());
      }, 1200);
    } catch {
      setActionError("We couldn't reach the server. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  if (!data) {
    return (
      <Card>
        <p role="status">Loading your booking status...</p>
      </Card>
    );
  }

  const label = STATUS_LABELS[data.status];

  return (
    <div>
      <Card>
        <h1 style={{ fontSize: "var(--text-xxl)", color: "var(--color-primary)", marginBottom: "var(--space-md)" }}>
          {label}
        </h1>
        <p style={{ fontSize: "var(--text-sm)", opacity: 0.85, marginBottom: "var(--space-md)" }}>
          Provider matching in this demo is simulated.
        </p>

        {actionError && (
          <p role="alert" style={{ color: "var(--color-error)", marginBottom: "var(--space-md)" }}>
            ⚠ {actionError}
          </p>
        )}

        {label === "Finding a Provider" && <p role="status">Looking for a suitable provider for this trip...</p>}

        {label === "Price Update: Action Required" && data.revisedEstimate && (
          <div>
            <p>Original price: ${data.originalEstimate.total.toFixed(2)}</p>
            <p>Revised price: ${data.revisedEstimate.total.toFixed(2)}</p>
            <p>Difference: +${data.revisedEstimate.difference.toFixed(2)}</p>
            <p>Reason: {data.revisedEstimate.reason}</p>
            <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
              <Button type="button" onClick={handleAcceptPrice} loading={actionLoading === "accept"}>
                Accept New Price and Confirm
              </Button>
              <Button type="button" variant="secondary" onClick={handleFindAnother} loading={actionLoading === "find-another"}>
                Find Another Option
              </Button>
            </div>
          </div>
        )}

        {label === "Searching for Another Provider" && <p role="status">Searching for another provider...</p>}

        {label === "Unable to Arrange This Trip" && (
          <p>
            We were not able to arrange this trip with our available fictional demo providers. This does not mean
            every trip like this is impossible to arrange in general -- only that our simulated providers could not
            meet every requirement this time.
          </p>
        )}
      </Card>
    </div>
  );
}
