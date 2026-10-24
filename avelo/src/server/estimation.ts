/**
 * Shared estimate computation used by POST /api/estimate and re-verified
 * by POST /api/booking/request (so a stale client-side estimate can never
 * be silently accepted at submission time).
 */
import { calculatePricing } from "@/domain/pricingEngine";
import { calculateSuggestedPickupTime, explainSuggestedPickupTime } from "@/domain/pickupTimeCalculator";
import type { BookingFormData, EstimateResult, PickupTimeError } from "@/domain/types";

export function computeEstimate(form: BookingFormData): EstimateResult | PickupTimeError {
  const pickupResult = calculateSuggestedPickupTime(
    form.outbound.pickupAddress,
    form.outbound.destinationAddress,
    form.outbound.requiredArrivalTime,
  );
  if ("error" in pickupResult) {
    return pickupResult;
  }

  const returnOrigin = form.return.originAddress.trim() || form.outbound.destinationAddress;
  const returnDestination = form.return.destinationAddress.trim() || form.outbound.pickupAddress;

  const pricing = calculatePricing({
    outboundPickupAddress: form.outbound.pickupAddress,
    outboundDestinationAddress: form.outbound.destinationAddress,
    returnOriginAddress: returnOrigin,
    returnDestinationAddress: returnDestination,
    mobility: form.requirements.mobility,
    specialRequests: form.requirements.specialRequests,
  });

  const explanation = explainSuggestedPickupTime(
    form.outbound.pickupAddress,
    form.outbound.destinationAddress,
    pickupResult.suggestedPickupTime,
  );

  return {
    outboundEstimate: pricing.outboundEstimate,
    returnEstimate: pricing.returnEstimate,
    total: pricing.total,
    specialRequestPending: pricing.specialRequestPending,
    suggestedPickupTime: pickupResult.suggestedPickupTime,
    explanation,
  };
}
