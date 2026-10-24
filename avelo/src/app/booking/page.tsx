"use client";

/**
 * Booking Form screen (Tasks 1.6-1.13, 2.7): manual entry for every
 * BookingFormData field, the VoiceCaptureControl (voice + typed NL input
 * sharing the same extraction pipeline), inline validation wired to the
 * shared FormValidator, a section-completion progress indicator, and the
 * "Review Estimate" action gated on zero validation errors.
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBooking } from "@/components/booking/BookingProvider";
import { VoiceCaptureControl } from "@/components/voice/VoiceCaptureControl";
import { useHighlightedFields } from "@/components/voice/useHighlightedFields";
import { ValidationErrorSummary } from "@/components/booking/ValidationErrorSummary";
import { Card } from "@/components/ui/Card";
import { Field, fieldInputStyle } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { HOSPITAL_DIRECTORY, findHospital } from "@/domain/hospitalDirectory";
import type { FieldPath, ValidationError } from "@/domain/types";

function errorFor(errors: ValidationError[], field: FieldPath): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

const SECTION_FIELDS: Record<string, FieldPath[]> = {
  "Caregiver & Passenger": ["caregiver.name", "caregiver.phone", "passenger.name"],
  Outbound: ["outbound.pickupAddress", "outbound.destinationName", "outbound.destinationAddress", "outbound.tripDate", "outbound.requiredArrivalTime"],
  Return: ["return.pickupTime"],
  Requirements: ["requirements.mobility", "requirements.companionCount"],
};

export default function BookingFormPage() {
  const router = useRouter();
  const { state, errors, setField, setEstimate } = useBooking();
  const highlighted = useHighlightedFields(state.lastChangedFields);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const firstInvalidRef = useRef<HTMLInputElement | null>(null);

  const completedSections = useMemo(() => {
    return Object.entries(SECTION_FIELDS).filter(([, fields]) => fields.every((f) => !errors.some((e) => e.field === f))).length;
  }, [errors]);

  const knownHospital = findHospital(state.form.outbound.destinationName);

  const hl = (field: FieldPath) => (highlighted.has(field) ? { background: "#EAF5F0" } : undefined);

  async function handleReviewEstimate() {
    setSubmitAttempted(true);
    setSubmitError(null);
    if (errors.length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: state.form }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setSubmitError(body?.error?.message ?? "We couldn't calculate an estimate. Please try again.");
        setLoading(false);
        return;
      }
      const estimate = await response.json();
      setEstimate(estimate);
      router.push("/review");
    } catch {
      setSubmitError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Card>
        <h1 style={{ fontSize: "var(--text-xxl)", color: "var(--color-primary)", marginBottom: "4px" }}>Schedule a Ride</h1>
        <p style={{ marginBottom: "var(--space-md)" }}>
          {completedSections} of {Object.keys(SECTION_FIELDS).length} sections complete
        </p>

        {submitAttempted && <ValidationErrorSummary ref={summaryRef} errors={errors} />}
        {submitError && (
          <p role="alert" style={{ color: "var(--color-error)", marginBottom: "var(--space-md)" }}>
            ⚠ {submitError}
          </p>
        )}

        <VoiceCaptureControl />

        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)" }}>Caregiver &amp; Passenger</h2>
        <Field id="caregiver-name" label="Your Name" helpText="So the provider knows who arranged the ride." error={submitAttempted ? errorFor(errors, "caregiver.name") : undefined}>
          <input
            ref={firstInvalidRef}
            id="caregiver-name"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "caregiver.name")), ...hl("caregiver.name") }}
            value={state.form.caregiver.name}
            onChange={(e) => setField("caregiver.name", e.target.value)}
          />
        </Field>
        <Field id="caregiver-phone" label="Phone Number" helpText="So the provider can reach you about this ride." error={submitAttempted ? errorFor(errors, "caregiver.phone") : undefined}>
          <input
            id="caregiver-phone"
            type="tel"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "caregiver.phone")), ...hl("caregiver.phone") }}
            value={state.form.caregiver.phone}
            onChange={(e) => setField("caregiver.phone", e.target.value)}
          />
        </Field>
        <Field id="passenger-name" label="Passenger Name" helpText="The person being transported." error={submitAttempted ? errorFor(errors, "passenger.name") : undefined}>
          <input
            id="passenger-name"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "passenger.name")), ...hl("passenger.name") }}
            value={state.form.passenger.name}
            onChange={(e) => setField("passenger.name", e.target.value)}
          />
        </Field>

        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)" }}>Outbound Trip</h2>
        <Field id="pickup-address" label="Pickup Address" helpText="Where the passenger will be picked up." error={submitAttempted ? errorFor(errors, "outbound.pickupAddress") : undefined}>
          <input
            id="pickup-address"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "outbound.pickupAddress")), ...hl("outbound.pickupAddress") }}
            value={state.form.outbound.pickupAddress}
            onChange={(e) => setField("outbound.pickupAddress", e.target.value)}
          />
        </Field>
        <Field
          id="destination-name"
          label="Destination / Hospital"
          helpText="The name of the clinic or hospital. Choose a listed demo hospital to fill in its address automatically."
          error={submitAttempted ? errorFor(errors, "outbound.destinationName") : undefined}
        >
          <input
            id="destination-name"
            list="hospital-directory"
            autoComplete="off"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "outbound.destinationName")), ...hl("outbound.destinationName") }}
            value={state.form.outbound.destinationName}
            onChange={(e) => setField("outbound.destinationName", e.target.value)}
          />
          <datalist id="hospital-directory">
            {HOSPITAL_DIRECTORY.map((h) => (
              <option key={h.name} value={h.name} />
            ))}
          </datalist>
        </Field>
        <Field
          id="destination-address"
          label="Destination Address"
          helpText={
            state.destinationAddressAuto
              ? `Filled in from Avelo's demo hospital directory for ${state.form.outbound.destinationName}. Demo addresses are fictional and not verified. You can edit it.`
              : "The street address of the destination."
          }
          error={submitAttempted ? errorFor(errors, "outbound.destinationAddress") : undefined}
        >
          <input
            id="destination-address"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "outbound.destinationAddress")), ...hl("outbound.destinationAddress") }}
            value={state.form.outbound.destinationAddress}
            onChange={(e) => setField("outbound.destinationAddress", e.target.value)}
          />
          {knownHospital && state.form.outbound.destinationAddress !== knownHospital.address && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setField("outbound.destinationAddress", knownHospital.address)}
              style={{ marginTop: "8px" }}
            >
              Use the address on file: {knownHospital.address}
            </Button>
          )}
        </Field>
        <Field id="trip-date" label="Trip Date" helpText="Both the outbound and return trip happen on this date." error={submitAttempted ? errorFor(errors, "outbound.tripDate") : undefined}>
          <input
            id="trip-date"
            type="date"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "outbound.tripDate")), ...hl("outbound.tripDate") }}
            value={state.form.outbound.tripDate}
            onChange={(e) => setField("outbound.tripDate", e.target.value)}
          />
        </Field>
        <Field id="required-arrival" label="Required Arrival Time" helpText="When the passenger must arrive at the destination." error={submitAttempted ? errorFor(errors, "outbound.requiredArrivalTime") : undefined}>
          <input
            id="required-arrival"
            type="time"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "outbound.requiredArrivalTime")), ...hl("outbound.requiredArrivalTime") }}
            value={state.form.outbound.requiredArrivalTime}
            onChange={(e) => setField("outbound.requiredArrivalTime", e.target.value)}
          />
        </Field>
        <p style={{ fontSize: "var(--text-sm)", opacity: 0.85, marginBottom: "var(--space-lg)" }}>
          The suggested pickup time will be calculated automatically and shown on the next screen.
        </p>

        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)" }}>Return Trip</h2>
        <Field id="return-pickup-time" label="Return Pickup Time" helpText="Must be later than the required arrival time." error={submitAttempted ? errorFor(errors, "return.pickupTime") : undefined}>
          <input
            id="return-pickup-time"
            type="time"
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "return.pickupTime")), ...hl("return.pickupTime") }}
            value={state.form.return.pickupTime}
            onChange={(e) => setField("return.pickupTime", e.target.value)}
          />
        </Field>
        <Field id="return-origin" label="Return Pickup Address" helpText="Defaults to the outbound destination. Edit if the return trip starts elsewhere.">
          <input
            id="return-origin"
            style={{ ...fieldInputStyle(false), ...hl("return.originAddress") }}
            value={state.form.return.originAddress}
            placeholder={state.form.outbound.destinationAddress || "Same as destination address above"}
            onChange={(e) => setField("return.originAddress", e.target.value)}
          />
        </Field>
        <Field id="return-destination" label="Return Destination Address" helpText="Defaults to the outbound pickup address. Edit if the return trip ends elsewhere.">
          <input
            id="return-destination"
            style={{ ...fieldInputStyle(false), ...hl("return.destinationAddress") }}
            value={state.form.return.destinationAddress}
            placeholder={state.form.outbound.pickupAddress || "Same as pickup address above"}
            onChange={(e) => setField("return.destinationAddress", e.target.value)}
          />
        </Field>

        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)" }}>Transportation Requirements</h2>
        <Field id="mobility" label="Mobility" helpText="Select whichever applies to the passenger." error={submitAttempted ? errorFor(errors, "requirements.mobility") : undefined}>
          <div role="radiogroup" aria-labelledby="mobility" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="radio"
                name="mobility"
                checked={state.form.requirements.mobility === "can-transfer"}
                onChange={() => setField("requirements.mobility", "can-transfer")}
              />
              Passenger can transfer to a vehicle seat
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="radio"
                name="mobility"
                checked={state.form.requirements.mobility === "must-remain-in-wheelchair"}
                onChange={() => setField("requirements.mobility", "must-remain-in-wheelchair")}
              />
              Passenger must remain in their wheelchair
            </label>
          </div>
        </Field>
        <Field id="companion-count" label="Number of Companions" helpText="Other riders joining the passenger (0-4)." error={submitAttempted ? errorFor(errors, "requirements.companionCount") : undefined}>
          <input
            id="companion-count"
            type="number"
            min={0}
            max={4}
            style={{ ...fieldInputStyle(submitAttempted && !!errorFor(errors, "requirements.companionCount")), ...hl("requirements.companionCount") }}
            value={state.form.requirements.companionCount}
            onChange={(e) => setField("requirements.companionCount", Number(e.target.value))}
          />
        </Field>
        <Field id="special-requests" label="Additional Assistance / Special Requests" helpText="Optional. Describe any extra help the passenger needs.">
          <textarea
            id="special-requests"
            rows={3}
            style={{ ...fieldInputStyle(false), ...hl("requirements.specialRequests") }}
            value={state.form.requirements.specialRequests}
            onChange={(e) => setField("requirements.specialRequests", e.target.value)}
          />
        </Field>

        <Button type="button" onClick={handleReviewEstimate} loading={loading} style={{ marginTop: "var(--space-md)" }}>
          Review Estimate
        </Button>
      </Card>
    </div>
  );
}

