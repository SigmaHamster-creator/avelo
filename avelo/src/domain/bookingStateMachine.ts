/**
 * BookingStateMachine (Tasks 3.1, 3.2): the sole source of truth for
 * booking status. `transition` is the only function permitted to compute
 * the next status; every API route must go through it. Any event not
 * listed for the current state is rejected (returns null) without
 * changing state -- this also serves as the duplicate-submission guard
 * (e.g. `requestArrangement` is only valid from `EstimateReady`).
 */
import type { BookingEvent, BookingStatus } from "./types";

type TransitionTable = Partial<Record<BookingStatus, Partial<Record<BookingEvent, BookingStatus>>>>;

const TRANSITIONS: TransitionTable = {
  Draft: { markEstimateReady: "EstimateReady" },
  EstimateReady: { requestArrangement: "RequestSubmitted" },
  RequestSubmitted: { startSearching: "Searching" },
  Searching: {
    candidateFound: "CandidateFound",
    noCandidateAvailable: "Unmatched",
  },
  SearchingAgain: {
    candidateFound: "CandidateFound",
    noCandidateAvailable: "Unmatched",
  },
  Unmatched: { declareUnableToArrange: "UnableToArrange" },
  UnableToArrange: {},
  CandidateFound: {
    providerAcceptsSamePrice: "ProviderAcceptedSamePrice",
    providerProposesRevision: "ProviderProposedRevision",
  },
  ProviderAcceptedSamePrice: { confirmAfterAcceptance: "Confirmed" },
  ProviderProposedRevision: {
    acceptNewPrice: "Confirmed",
    findAnother: "SearchingAgain",
  },
  Confirmed: { requestReplacement: "ReplacementRequested" },
  ReplacementRequested: { startSearching: "ReplacementSearching" },
  ReplacementSearching: {
    replacementCandidateFound: "ReplacementFound",
    noCandidateAvailable: "Unmatched",
  },
  ReplacementFound: {
    replacementAcceptsSamePrice: "ReplacementAcceptedSamePrice",
    replacementProposesRevision: "ReplacementProposedRevision",
  },
  ReplacementAcceptedSamePrice: { confirmReplacementAfterAcceptance: "ReplacementConfirmed" },
  ReplacementProposedRevision: {
    acceptReplacementPrice: "ReplacementConfirmed",
    findAnotherReplacement: "ReplacementSearching",
  },
  ReplacementConfirmed: { requestReplacement: "ReplacementRequested" },
};

export interface TransitionResult {
  ok: boolean;
  nextStatus: BookingStatus;
  rejected: boolean;
}

export function transition(current: BookingStatus, event: BookingEvent): TransitionResult {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    return { ok: false, nextStatus: current, rejected: true };
  }
  return { ok: true, nextStatus: next, rejected: false };
}

export function isTransitionAllowed(current: BookingStatus, event: BookingEvent): boolean {
  return Boolean(TRANSITIONS[current]?.[event]);
}

/** States in which the booking is considered an active, confirmed arrangement. */
export function isConfirmedStatus(status: BookingStatus): boolean {
  return status === "Confirmed" || status === "ReplacementConfirmed";
}
