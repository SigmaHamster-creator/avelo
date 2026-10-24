import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateSuggestedPickupTime, explainSuggestedPickupTime } from "../pickupTimeCalculator";
import { ARRIVAL_BUFFER_MINUTES, resolveDistanceTier } from "../routeFixtures";

describe("PickupTimeCalculator", () => {
  it("AC-TIME-01: 10:00 arrival with a 60-minute route and a 30-minute buffer suggests 08:30", () => {
    // Find an address pair that resolves to the 60-minute ("long") tier.
    let pickup = "";
    let destination = "";
    outer: for (let i = 0; i < 300; i += 1) {
      for (let j = 0; j < 300; j += 1) {
        const a = `Pickup${i}`;
        const b = `Destination${j}`;
        if (resolveDistanceTier(a, b).travelDurationMinutes === 60) {
          pickup = a;
          destination = b;
          break outer;
        }
      }
    }
    expect(pickup).not.toBe("");

    const result = calculateSuggestedPickupTime(pickup, destination, "10:00");
    expect(result).toEqual({ suggestedPickupTime: "08:30" });

    const explanation = explainSuggestedPickupTime(pickup, destination, "08:30");
    expect(explanation).toBe("Suggested pickup: 8:30 AM, allowing 60 minutes for travel and a 30-minute arrival buffer.");
  });

  it("AC-TIME-04: returns an actionable OUT_OF_BOUNDS error instead of shifting the date", () => {
    const result = calculateSuggestedPickupTime("X", "Y", "00:05");
    expect(result).toHaveProperty("error", "OUT_OF_BOUNDS");
    if ("message" in result) {
      expect(result.message.toLowerCase()).toContain("midnight");
    }
  });

  it("never describes the calculation as based on live traffic", () => {
    const explanation = explainSuggestedPickupTime("X", "Y", "08:00");
    expect(explanation.toLowerCase()).not.toContain("traffic");
  });

  // Property 11: Suggested pickup time equals arrival minus duration minus buffer, or a bounds error.
  it("Property 11: suggestedPickupTime == requiredArrival - travelDuration - buffer, whenever it resolves", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (hour, minute, a, b) => {
          const arrival = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const tier = resolveDistanceTier(a, b);
          const arrivalMinutes = hour * 60 + minute;
          const expectedMinutes = arrivalMinutes - tier.travelDurationMinutes - ARRIVAL_BUFFER_MINUTES;

          const result = calculateSuggestedPickupTime(a, b, arrival);

          if (expectedMinutes < 0) {
            expect(result).toHaveProperty("error", "OUT_OF_BOUNDS");
          } else {
            const expectedHHMM = `${String(Math.floor(expectedMinutes / 60)).padStart(2, "0")}:${String(expectedMinutes % 60).padStart(2, "0")}`;
            expect(result).toEqual({ suggestedPickupTime: expectedHHMM });
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
