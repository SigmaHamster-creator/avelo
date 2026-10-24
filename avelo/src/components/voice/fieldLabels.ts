import type { FieldPath } from "@/domain/types";

/** Human-readable labels for the field-change summary and highlighting. */
export const FIELD_LABELS: Record<FieldPath, string> = {
  "caregiver.name": "your name",
  "caregiver.phone": "your phone number",
  "passenger.name": "the passenger's name",
  "outbound.pickupAddress": "the pickup address",
  "outbound.destinationName": "the destination/hospital name",
  "outbound.destinationAddress": "the destination address",
  "outbound.tripDate": "the trip date",
  "outbound.requiredArrivalTime": "the required arrival time",
  "return.pickupTime": "the return pickup time",
  "return.originAddress": "the return pickup address",
  "return.destinationAddress": "the return destination address",
  "requirements.mobility": "the mobility requirement",
  "requirements.companionCount": "the number of companions",
  "requirements.specialRequests": "the special requests",
};

export function summarizeChangedFields(fields: FieldPath[]): string {
  if (fields.length === 0) return "No fields were mentioned, so nothing changed.";
  const labels = fields.map((f) => FIELD_LABELS[f]);
  return `Updated ${labels.join(", ")}.`;
}
