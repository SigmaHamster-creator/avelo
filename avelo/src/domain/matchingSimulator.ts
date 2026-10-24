/**
 * MatchingSimulator (Tasks 3.4, 5.1): pure guard logic deciding whether a
 * fictional candidate provider satisfies the hard requirements of a
 * booking request (service area, wheelchair accommodation, companion
 * capacity, both legs). This never returns "accepted" for a candidate
 * that fails a hard requirement -- demo scenarios decide WHICH candidate
 * and WHICH price branch to use, but this module decides whether that
 * candidate is legitimately eligible at all.
 */
import type { BookingFormData } from "./types";

export interface CandidateProviderFixture {
  name: string;
  vehicleType: string;
  accessibilityEquipment: string[];
  servesWheelchair: boolean;
  maxCompanions: number;
  /** Service-area coverage, matched loosely against the request's addresses. */
  serviceAreaKeywords: string[];
}

export type MatchOutcome = "eligible" | "ineligible";

export function evaluateCandidate(
  form: BookingFormData,
  candidate: CandidateProviderFixture,
): MatchOutcome {
  if (form.requirements.mobility === "must-remain-in-wheelchair" && !candidate.servesWheelchair) {
    return "ineligible";
  }
  if (form.requirements.companionCount > candidate.maxCompanions) {
    return "ineligible";
  }

  const addresses = [
    form.outbound.pickupAddress,
    form.outbound.destinationAddress,
    form.return.originAddress,
    form.return.destinationAddress,
  ]
    .join(" ")
    .toLowerCase();

  const servesArea =
    candidate.serviceAreaKeywords.length === 0 ||
    candidate.serviceAreaKeywords.some((keyword) => addresses.includes(keyword.toLowerCase()));

  if (!servesArea) {
    return "ineligible";
  }

  return "eligible";
}
