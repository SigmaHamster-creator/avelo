/**
 * PricingEngine (Task 2.2): deterministic price calculation from the route
 * fixture, vehicle accessibility category, both legs, and the
 * special-request-pending flag. Pure function, no I/O.
 */
import { ACCESSIBILITY_MULTIPLIER, accessibilityCategoryFor, resolveDistanceTier } from "./routeFixtures";
import type { BookingFormData } from "./types";

export interface PricingInput {
  outboundPickupAddress: string;
  outboundDestinationAddress: string;
  returnOriginAddress: string;
  returnDestinationAddress: string;
  mobility: BookingFormData["requirements"]["mobility"];
  specialRequests: string;
}

export interface PricingOutput {
  outboundEstimate: number;
  returnEstimate: number;
  total: number;
  specialRequestPending: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculatePricing(input: PricingInput): PricingOutput {
  const mobility = input.mobility ?? "can-transfer";
  const category = accessibilityCategoryFor(mobility);
  const multiplier = ACCESSIBILITY_MULTIPLIER[category];

  const outboundTier = resolveDistanceTier(input.outboundPickupAddress, input.outboundDestinationAddress);
  const returnTier = resolveDistanceTier(input.returnOriginAddress, input.returnDestinationAddress);

  const outboundEstimate = round2(outboundTier.baseFarePerLeg * multiplier);
  const returnEstimate = round2(returnTier.baseFarePerLeg * multiplier);
  const total = round2(outboundEstimate + returnEstimate);

  const specialRequestPending = input.specialRequests.trim().length > 0;

  return { outboundEstimate, returnEstimate, total, specialRequestPending };
}
