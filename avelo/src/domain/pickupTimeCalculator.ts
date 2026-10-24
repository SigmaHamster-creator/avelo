/**
 * PickupTimeCalculator (Task 2.4): Suggested Pickup Time =
 * Required Arrival Time - travel duration (route fixture) - documented buffer.
 *
 * This is fixture-based, never a live-traffic prediction. If the result
 * would fall before 00:00 on the trip date, an explicit OUT_OF_BOUNDS error
 * is returned instead of silently shifting the date.
 */
import { ARRIVAL_BUFFER_MINUTES, resolveDistanceTier } from "./routeFixtures";
import type { PickupTimeError, PickupTimeResult } from "./types";

function parseTimeToMinutes(hhmm: string): number | null {
  const match = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatHHMMTo12Hour(hhmm: string): string {
  const minutes = parseTimeToMinutes(hhmm);
  if (minutes === null) return hhmm;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function calculateSuggestedPickupTime(
  pickupAddress: string,
  destinationAddress: string,
  requiredArrivalTime: string,
): PickupTimeResult | PickupTimeError {
  const arrivalMinutes = parseTimeToMinutes(requiredArrivalTime);
  if (arrivalMinutes === null) {
    return { error: "OUT_OF_BOUNDS", message: "The required arrival time is not a valid time." };
  }

  const tier = resolveDistanceTier(pickupAddress, destinationAddress);
  const suggestedMinutes = arrivalMinutes - tier.travelDurationMinutes - ARRIVAL_BUFFER_MINUTES;

  if (suggestedMinutes < 0) {
    return {
      error: "OUT_OF_BOUNDS",
      message:
        `A pickup at this required arrival time would need to start before midnight on the trip date ` +
        `(${tier.travelDurationMinutes} minutes of travel plus a ${ARRIVAL_BUFFER_MINUTES}-minute buffer). ` +
        `Please choose a later required arrival time or an earlier trip date.`,
    };
  }

  return { suggestedPickupTime: minutesToHHMM(suggestedMinutes) };
}

export function explainSuggestedPickupTime(
  pickupAddress: string,
  destinationAddress: string,
  suggestedPickupTime: string,
): string {
  const tier = resolveDistanceTier(pickupAddress, destinationAddress);
  return (
    `Suggested pickup: ${formatHHMMTo12Hour(suggestedPickupTime)}, allowing ${tier.travelDurationMinutes} minutes ` +
    `for travel and a ${ARRIVAL_BUFFER_MINUTES}-minute arrival buffer.`
  );
}
