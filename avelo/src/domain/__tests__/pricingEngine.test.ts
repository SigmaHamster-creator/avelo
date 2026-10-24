import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculatePricing } from "../pricingEngine";
import { ACCESSIBILITY_MULTIPLIER, ROUTE_FIXTURES, resolveDistanceTier } from "../routeFixtures";

describe("PricingEngine", () => {
  it("matches the documented worked example for a given tier/accessibility combination", () => {
    // Find two addresses that resolve to known tiers deterministically.
    const outboundTier = resolveDistanceTier("A", "B");
    const returnTier = resolveDistanceTier("B", "A");

    const result = calculatePricing({
      outboundPickupAddress: "A",
      outboundDestinationAddress: "B",
      returnOriginAddress: "B",
      returnDestinationAddress: "A",
      mobility: "must-remain-in-wheelchair",
      specialRequests: "",
    });

    const multiplier = ACCESSIBILITY_MULTIPLIER["wheelchair-accessible"];
    expect(result.outboundEstimate).toBeCloseTo(outboundTier.baseFarePerLeg * multiplier, 2);
    expect(result.returnEstimate).toBeCloseTo(returnTier.baseFarePerLeg * multiplier, 2);
  });

  it("AC-PRICE-04 / Property 10: total is always the sum of outbound + return, and is deterministic", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom("can-transfer", "must-remain-in-wheelchair"),
        fc.string(),
        (addrA, addrB, mobility, specialRequests) => {
          const input = {
            outboundPickupAddress: addrA,
            outboundDestinationAddress: addrB,
            returnOriginAddress: addrB,
            returnDestinationAddress: addrA,
            mobility: mobility as "can-transfer" | "must-remain-in-wheelchair",
            specialRequests,
          };
          const r1 = calculatePricing(input);
          const r2 = calculatePricing(input);
          expect(r1).toEqual(r2); // deterministic
          expect(r1.total).toBeCloseTo(r1.outboundEstimate + r1.returnEstimate, 2);
          expect(r1.specialRequestPending).toBe(specialRequests.trim().length > 0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("wheelchair accessibility always costs at least as much as can-transfer for the same route", () => {
    const input = (mobility: "can-transfer" | "must-remain-in-wheelchair") => ({
      outboundPickupAddress: "123 Main St",
      outboundDestinationAddress: "456 Oak Ave",
      returnOriginAddress: "456 Oak Ave",
      returnDestinationAddress: "123 Main St",
      mobility,
      specialRequests: "",
    });
    const standard = calculatePricing(input("can-transfer"));
    const wheelchair = calculatePricing(input("must-remain-in-wheelchair"));
    expect(wheelchair.total).toBeGreaterThanOrEqual(standard.total);
  });

  it("documents the fixture tiers exactly as specified", () => {
    expect(ROUTE_FIXTURES.short).toEqual({ tier: "short", travelDurationMinutes: 15, baseFarePerLeg: 18 });
    expect(ROUTE_FIXTURES.medium).toEqual({ tier: "medium", travelDurationMinutes: 35, baseFarePerLeg: 32 });
    expect(ROUTE_FIXTURES.long).toEqual({ tier: "long", travelDurationMinutes: 60, baseFarePerLeg: 52 });
    expect(ROUTE_FIXTURES["rural-long"]).toEqual({ tier: "rural-long", travelDurationMinutes: 90, baseFarePerLeg: 75 });
  });
});
