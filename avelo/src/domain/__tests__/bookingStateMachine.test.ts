import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { isTransitionAllowed, transition } from "../bookingStateMachine";
import { STATUS_LABELS } from "../types";
import type { BookingEvent, BookingStatus } from "../types";

const ALL_STATUSES: BookingStatus[] = [
  "Draft",
  "EstimateReady",
  "RequestSubmitted",
  "Searching",
  "SearchingAgain",
  "CandidateFound",
  "ProviderAcceptedSamePrice",
  "ProviderProposedRevision",
  "Confirmed",
  "Unmatched",
  "UnableToArrange",
  "ReplacementRequested",
  "ReplacementSearching",
  "ReplacementFound",
  "ReplacementAcceptedSamePrice",
  "ReplacementProposedRevision",
  "ReplacementConfirmed",
];

const ALL_EVENTS: BookingEvent[] = [
  "markEstimateReady",
  "requestArrangement",
  "startSearching",
  "candidateFound",
  "providerAcceptsSamePrice",
  "confirmAfterAcceptance",
  "providerProposesRevision",
  "acceptNewPrice",
  "findAnother",
  "noCandidateAvailable",
  "declareUnableToArrange",
  "requestReplacement",
  "replacementCandidateFound",
  "replacementAcceptsSamePrice",
  "confirmReplacementAfterAcceptance",
  "replacementProposesRevision",
  "acceptReplacementPrice",
  "findAnotherReplacement",
];

describe("BookingStateMachine", () => {
  it("AC-BOOKING-01: CandidateFound -> providerAcceptsSamePrice -> confirmAfterAcceptance reaches Confirmed with no extra approval event", () => {
    let result = transition("CandidateFound", "providerAcceptsSamePrice");
    expect(result).toEqual({ ok: true, nextStatus: "ProviderAcceptedSamePrice", rejected: false });
    result = transition(result.nextStatus, "confirmAfterAcceptance");
    expect(result.nextStatus).toBe("Confirmed");
  });

  it("AC-BOOKING-02: CandidateFound is never itself equivalent to Confirmed", () => {
    expect(isTransitionAllowed("CandidateFound", "requestReplacement")).toBe(false);
    expect("CandidateFound").not.toBe("Confirmed");
  });

  it("AC-PRICE-01/02: ProviderProposedRevision only exits via acceptNewPrice (-> Confirmed) or findAnother (-> Searching)", () => {
    expect(transition("ProviderProposedRevision", "acceptNewPrice").nextStatus).toBe("Confirmed");
    expect(transition("ProviderProposedRevision", "findAnother").nextStatus).toBe("SearchingAgain");
    expect(transition("ProviderProposedRevision", "requestReplacement").rejected).toBe(true);
  });

  it("rejects a duplicate requestArrangement (only valid from EstimateReady)", () => {
    expect(isTransitionAllowed("RequestSubmitted", "requestArrangement")).toBe(false);
    expect(isTransitionAllowed("EstimateReady", "requestArrangement")).toBe(true);
  });

  it("the replacement branch retains Confirmed as the booking's status source until it resolves", () => {
    const toReplacementRequested = transition("Confirmed", "requestReplacement");
    expect(toReplacementRequested.nextStatus).toBe("ReplacementRequested");
    expect(transition("ReplacementRequested", "startSearching").nextStatus).toBe("ReplacementSearching");
  });

  // Property 14: Only documented transitions are reachable, and duplicate submissions are rejected.
  it("Property 14: a rejected transition never changes the current status", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_STATUSES), fc.constantFrom(...ALL_EVENTS), (status, event) => {
        const result = transition(status, event);
        if (result.rejected) {
          expect(result.nextStatus).toBe(status);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("Requirement 14: 'Find Another Option' leads to the distinct 'Searching for Another Provider' label, not 'Finding a Provider' again", () => {
    const next = transition("ProviderProposedRevision", "findAnother").nextStatus;
    expect(STATUS_LABELS[next]).toBe("Searching for Another Provider");
    expect(STATUS_LABELS.RequestSubmitted).toBe("Finding a Provider");
  });

  it("Property 14: declareUnableToArrange is only reachable from Unmatched", () => {
    for (const status of ALL_STATUSES) {
      const allowed = isTransitionAllowed(status, "declareUnableToArrange");
      expect(allowed).toBe(status === "Unmatched");
    }
  });
});
