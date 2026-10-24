import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { evaluateCandidate, type CandidateProviderFixture } from "../matchingSimulator";
import { createEmptyFormData } from "../types";
import type { BookingFormData, Mobility } from "../types";

function formWith(mobility: Mobility, companionCount: number): BookingFormData {
  const form = createEmptyFormData();
  form.requirements.mobility = mobility;
  form.requirements.companionCount = companionCount;
  return form;
}

const candidate: CandidateProviderFixture = {
  name: "Test Rides",
  vehicleType: "Van",
  accessibilityEquipment: ["Ramp"],
  servesWheelchair: false,
  maxCompanions: 2,
  serviceAreaKeywords: [],
};

describe("MatchingSimulator", () => {
  it("AC-BOOKING-03: never accepts a wheelchair request against a non-wheelchair candidate", () => {
    const form = formWith("must-remain-in-wheelchair", 0);
    expect(evaluateCandidate(form, candidate)).toBe("ineligible");
  });

  it("accepts a can-transfer request within companion capacity", () => {
    const form = formWith("can-transfer", 2);
    expect(evaluateCandidate(form, candidate)).toBe("eligible");
  });

  it("never accepts a request exceeding the candidate's companion capacity", () => {
    const form = formWith("can-transfer", 3);
    expect(evaluateCandidate(form, candidate)).toBe("ineligible");
  });

  // Property 15: Matching never selects a candidate failing a hard requirement.
  it("Property 15: eligibility never contradicts the wheelchair/companion hard requirements", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Mobility>("can-transfer", "must-remain-in-wheelchair"),
        fc.integer({ min: 0, max: 6 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 6 }),
        (mobility, companionCount, servesWheelchair, maxCompanions) => {
          const form = formWith(mobility, companionCount);
          const testCandidate: CandidateProviderFixture = { ...candidate, servesWheelchair, maxCompanions, serviceAreaKeywords: [] };
          const outcome = evaluateCandidate(form, testCandidate);

          const wheelchairOk = mobility !== "must-remain-in-wheelchair" || servesWheelchair;
          const companionsOk = companionCount <= maxCompanions;

          if (outcome === "eligible") {
            expect(wheelchairOk).toBe(true);
            expect(companionsOk).toBe(true);
          }
          if (!wheelchairOk || !companionsOk) {
            expect(outcome).toBe("ineligible");
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
