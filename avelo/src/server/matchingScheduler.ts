/**
 * Server-side matching scheduler (Tasks 3.7, 5.2, 6.2, 7.6): drives
 * BookingStateMachine + MatchingSimulator deterministically per the
 * active Demo Scenario fixture, using fixed (non-random) delays so a run
 * is always reproducible. This is the "DemoScenarioRunner" from design.md.
 */
import { applyEvent, getBooking, scheduleTimer } from "./bookingStore";
import { evaluateCandidate } from "@/domain/matchingSimulator";
import { SCENARIOS } from "@/domain/demoScenarios";
import type { Booking } from "@/domain/types";

const CONFIRM_PACING_MS = 400;
const UNABLE_TO_ARRANGE_PACING_MS = 400;

function scenarioFor(booking: Booking) {
  return SCENARIOS[booking.scenarioId ?? "standard"];
}

/** Kicks off the primary (non-replacement) search for a freshly-submitted booking. */
export function startPrimarySearch(bookingId: string): void {
  const booking = getBooking(bookingId);
  if (!booking) return;
  const scenario = scenarioFor(booking);
  scheduleTimer(bookingId, () => runPrimaryMatchStep(bookingId), scenario.searchDelayMs);
}

function runPrimaryMatchStep(bookingId: string): void {
  const booking = getBooking(bookingId);
  if (!booking || (booking.status !== "Searching" && booking.status !== "SearchingAgain")) return;

  const scenario = scenarioFor(booking);
  const attempt = (booking.matchAttempt ?? 0) + 1;
  const eligibility = evaluateCandidate(booking.form, scenario.candidate);

  if (eligibility === "ineligible" || scenario.outcome === "unmatched") {
    applyEvent(bookingId, "noCandidateAvailable", (b) => ({ ...b, matchAttempt: attempt }));
    scheduleTimer(bookingId, () => {
      applyEvent(bookingId, "declareUnableToArrange");
    }, UNABLE_TO_ARRANGE_PACING_MS);
    return;
  }

  applyEvent(bookingId, "candidateFound", (b) => ({
    ...b,
    matchAttempt: attempt,
    provider: {
      name: scenario.candidate.name,
      vehicleType: scenario.candidate.vehicleType,
      accessibilityEquipment: scenario.candidate.accessibilityEquipment,
    },
  }));

  // After the first find-another retry, the same candidate is re-offered
  // at the ORIGINAL price so the demo always reaches a confirmable state.
  const shouldReviseThisAttempt = scenario.outcome === "revised-price" && attempt === 1;

  if (shouldReviseThisAttempt && scenario.revision) {
    const revisedTotal = Math.round((booking.originalEstimate.total + scenario.revision.amountDelta) * 100) / 100;
    applyEvent(bookingId, "providerProposesRevision", (b) => ({
      ...b,
      revisedEstimate: {
        total: revisedTotal,
        difference: scenario.revision!.amountDelta,
        reason: scenario.revision!.reason,
      },
    }));
    return;
  }

  applyEvent(bookingId, "providerAcceptsSamePrice");
  scheduleTimer(bookingId, () => {
    applyEvent(bookingId, "confirmAfterAcceptance", (b) => ({
      ...b,
      confirmedProvider: b.provider,
      confirmedTotal: b.originalEstimate.total,
    }));
  }, CONFIRM_PACING_MS);
}

/** Resumes the primary search after "Find Another Option". */
export function resumePrimarySearch(bookingId: string): void {
  const booking = getBooking(bookingId);
  if (!booking) return;
  const scenario = scenarioFor(booking);
  scheduleTimer(bookingId, () => runPrimaryMatchStep(bookingId), scenario.searchDelayMs);
}

/** Kicks off the replacement search for an already-Confirmed booking. */
export function startReplacementSearch(bookingId: string): void {
  const booking = getBooking(bookingId);
  if (!booking) return;
  const scenario = scenarioFor(booking);
  scheduleTimer(bookingId, () => runReplacementMatchStep(bookingId), scenario.searchDelayMs);
}

function runReplacementMatchStep(bookingId: string): void {
  const booking = getBooking(bookingId);
  if (!booking || booking.status !== "ReplacementSearching") return;

  const scenario = scenarioFor(booking);
  const candidate = scenario.replacementCandidate ?? scenario.candidate;
  const attempt = (booking.replacementMatchAttempt ?? 0) + 1;
  const eligibility = evaluateCandidate(booking.form, candidate);

  if (eligibility === "ineligible") {
    applyEvent(bookingId, "noCandidateAvailable", (b) => ({ ...b, replacementMatchAttempt: attempt }));
    return;
  }

  applyEvent(bookingId, "replacementCandidateFound", (b) => ({
    ...b,
    replacementMatchAttempt: attempt,
  }));

  applyEvent(bookingId, "replacementAcceptsSamePrice", (b) => ({
    ...b,
    provider: {
      name: candidate.name,
      vehicleType: candidate.vehicleType,
      accessibilityEquipment: candidate.accessibilityEquipment,
    },
  }));
  scheduleTimer(bookingId, () => {
    applyEvent(bookingId, "confirmReplacementAfterAcceptance", (b) => ({
      ...b,
      confirmedProvider: b.provider,
      confirmedTotal: b.originalEstimate.total,
    }));
  }, CONFIRM_PACING_MS);
}

export function resumeReplacementSearch(bookingId: string): void {
  const booking = getBooking(bookingId);
  if (!booking) return;
  const scenario = scenarioFor(booking);
  scheduleTimer(bookingId, () => runReplacementMatchStep(bookingId), scenario.searchDelayMs);
}
