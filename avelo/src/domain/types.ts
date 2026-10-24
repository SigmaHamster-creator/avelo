/**
 * Avelo domain types.
 *
 * These types are the single source of truth for the booking form shape,
 * the voice/manual field-patch contract, validation errors, and booking
 * status. Every module in src/domain and every API route imports from here
 * so there is exactly one definition of each shape in the codebase.
 */

export type Mobility = "can-transfer" | "must-remain-in-wheelchair";

export interface CaregiverInfo {
  name: string;
  phone: string;
}

export interface PassengerInfo {
  name: string;
}

export interface OutboundLeg {
  pickupAddress: string;
  destinationName: string;
  destinationAddress: string;
  /** ISO date, YYYY-MM-DD. Both legs occur on this date (same-day assumption). */
  tripDate: string;
  /** ISO time, HH:mm (24h). */
  requiredArrivalTime: string;
  /**
   * Derived, read-only. Null until PickupTimeCalculator successfully
   * resolves it. Never set directly by manual or voice input.
   */
  suggestedPickupTime: string | null;
}

export interface ReturnLeg {
  /** ISO time, HH:mm (24h). Fixed, caregiver-chosen. */
  pickupTime: string;
  /** Defaults to outbound.destinationAddress until explicitly overridden. */
  originAddress: string;
  /** Defaults to outbound.pickupAddress until explicitly overridden. */
  destinationAddress: string;
}

export interface TransportRequirements {
  mobility: Mobility | null;
  companionCount: number;
  specialRequests: string;
}

export interface BookingFormData {
  caregiver: CaregiverInfo;
  passenger: PassengerInfo;
  outbound: OutboundLeg;
  return: ReturnLeg;
  requirements: TransportRequirements;
}

/** Tracks whether the caregiver has explicitly overridden a return-leg default. */
export interface ReturnLegOverrides {
  originAddress: boolean;
  destinationAddress: boolean;
}

export function createEmptyFormData(): BookingFormData {
  return {
    caregiver: { name: "", phone: "" },
    passenger: { name: "" },
    outbound: {
      pickupAddress: "",
      destinationName: "",
      destinationAddress: "",
      tripDate: "",
      requiredArrivalTime: "",
      suggestedPickupTime: null,
    },
    return: { pickupTime: "", originAddress: "", destinationAddress: "" },
    requirements: { mobility: null, companionCount: 0, specialRequests: "" },
  };
}

/**
 * A field-level patch value. A concrete value replaces the field; the
 * explicit `{ __clear: true }` marker clears it. Omission of a field from
 * the patch object entirely means "no change" (preserve).
 */
export type FieldValue<T> = T | { __clear: true };

export function isClearMarker(value: unknown): value is { __clear: true } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __clear?: unknown }).__clear === true
  );
}

export interface FormFieldPatch {
  caregiver?: {
    name?: FieldValue<string>;
    phone?: FieldValue<string>;
  };
  passenger?: {
    name?: FieldValue<string>;
  };
  outbound?: {
    pickupAddress?: FieldValue<string>;
    destinationName?: FieldValue<string>;
    destinationAddress?: FieldValue<string>;
    tripDate?: FieldValue<string>;
    requiredArrivalTime?: FieldValue<string>;
  };
  return?: {
    pickupTime?: FieldValue<string>;
    originAddress?: FieldValue<string>;
    destinationAddress?: FieldValue<string>;
  };
  requirements?: {
    mobility?: FieldValue<Mobility>;
    companionCount?: FieldValue<number>;
    specialRequests?: FieldValue<string>;
  };
}

/** Dotted field paths used for applied/rejected field reporting and highlighting. */
export type FieldPath =
  | "caregiver.name"
  | "caregiver.phone"
  | "passenger.name"
  | "outbound.pickupAddress"
  | "outbound.destinationName"
  | "outbound.destinationAddress"
  | "outbound.tripDate"
  | "outbound.requiredArrivalTime"
  | "return.pickupTime"
  | "return.originAddress"
  | "return.destinationAddress"
  | "requirements.mobility"
  | "requirements.companionCount"
  | "requirements.specialRequests";

export interface ValidationError {
  field: FieldPath;
  message: string;
  code: string;
}

export interface MergeResult {
  draft: BookingFormData;
  appliedFields: FieldPath[];
  /** Field paths present in the patch but dropped because a newer edit already touched them. */
  rejectedStaleFields: FieldPath[];
}

/** Which trip leg a voice-mentioned detail was resolved to. */
export type TripLeg = "outbound" | "return";

export type ExtractionSource = "deterministic-fallback" | "llm";

export interface VoiceExtractResult {
  patch: FormFieldPatch;
  resolvedLeg?: TripLeg;
  clarificationNeeded?: string;
  /** Plain-English confirmation note, e.g. the resolved calendar date. */
  note?: string;
  resolvedRelativeDate?: string;
  confidence: number;
  source: ExtractionSource;
}

/**
 * The full set of internal booking states. `CandidateFound` deliberately
 * sits between `Searching` and acceptance/revision states so a candidate
 * match alone is never conflated with a confirmed booking.
 */
export type BookingStatus =
  | "Draft"
  | "EstimateReady"
  | "RequestSubmitted"
  | "Searching"
  | "CandidateFound"
  | "ProviderAcceptedSamePrice"
  | "ProviderProposedRevision"
  | "Confirmed"
  | "Unmatched"
  | "UnableToArrange"
  /** A resumed primary search after "Find Another Option" -- distinct from the initial `Searching` so the caregiver-facing label can read "Searching for Another Provider". */
  | "SearchingAgain"
  | "ReplacementRequested"
  | "ReplacementSearching"
  | "ReplacementFound"
  | "ReplacementAcceptedSamePrice"
  | "ReplacementProposedRevision"
  | "ReplacementConfirmed";

/** The five caregiver-facing status labels required by the brief (Requirement 14). */
export type CaregiverStatusLabel =
  | "Finding a Provider"
  | "Price Update: Action Required"
  | "Booking Confirmed"
  | "Searching for Another Provider"
  | "Unable to Arrange This Trip";

export const STATUS_LABELS: Record<BookingStatus, CaregiverStatusLabel | "Draft"> = {
  Draft: "Draft",
  EstimateReady: "Draft",
  RequestSubmitted: "Finding a Provider",
  Searching: "Finding a Provider",
  CandidateFound: "Finding a Provider",
  ProviderAcceptedSamePrice: "Finding a Provider",
  ProviderProposedRevision: "Price Update: Action Required",
  Confirmed: "Booking Confirmed",
  Unmatched: "Finding a Provider",
  UnableToArrange: "Unable to Arrange This Trip",
  SearchingAgain: "Searching for Another Provider",
  ReplacementRequested: "Searching for Another Provider",
  ReplacementSearching: "Searching for Another Provider",
  ReplacementFound: "Searching for Another Provider",
  ReplacementAcceptedSamePrice: "Searching for Another Provider",
  ReplacementProposedRevision: "Price Update: Action Required",
  ReplacementConfirmed: "Booking Confirmed",
};

export type BookingEvent =
  | "markEstimateReady"
  | "requestArrangement"
  | "startSearching"
  | "candidateFound"
  | "providerAcceptsSamePrice"
  | "confirmAfterAcceptance"
  | "providerProposesRevision"
  | "acceptNewPrice"
  | "findAnother"
  | "noCandidateAvailable"
  | "declareUnableToArrange"
  | "requestReplacement"
  | "replacementCandidateFound"
  | "replacementAcceptsSamePrice"
  | "confirmReplacementAfterAcceptance"
  | "replacementProposesRevision"
  | "acceptReplacementPrice"
  | "findAnotherReplacement";

export interface DistanceTierFixture {
  tier: "short" | "medium" | "long" | "rural-long";
  travelDurationMinutes: number;
  baseFarePerLeg: number;
}

export interface EstimateResult {
  outboundEstimate: number;
  returnEstimate: number;
  total: number;
  specialRequestPending: boolean;
  suggestedPickupTime: string;
  explanation: string;
}

export interface PickupTimeResult {
  suggestedPickupTime: string;
}

export interface PickupTimeError {
  error: "OUT_OF_BOUNDS";
  message: string;
}

export interface ProviderInfo {
  name: string;
  vehicleType: string;
  accessibilityEquipment: string[];
}

export interface RevisedPriceInfo {
  total: number;
  difference: number;
  reason: string;
}

export interface Booking {
  bookingId: string;
  demoSessionId: string;
  epoch: number;
  status: BookingStatus;
  form: BookingFormData;
  originalEstimate: EstimateResult;
  revisedEstimate?: RevisedPriceInfo;
  provider?: ProviderInfo;
  history: { status: BookingStatus; at: string }[];
  scenarioId?: DemoScenarioId;
  replacement?: {
    reason: string;
  };
  /** Number of matching attempts made for the active (non-replacement) search, for find-another repeatability. */
  matchAttempt?: number;
  /** Number of matching attempts made for the replacement search. */
  replacementMatchAttempt?: number;
  /**
   * The provider/price currently in force for the caregiver-visible
   * arrangement. Set when the booking first reaches `Confirmed`, and only
   * updated again when a replacement reaches `ReplacementConfirmed` --
   * this is what keeps the original confirmed arrangement visible and
   * unchanged while a replacement search is in progress (Requirement 81).
   */
  confirmedProvider?: ProviderInfo;
  confirmedTotal?: number;
}

export type DemoScenarioId =
  | "standard"
  | "special-request-revision"
  | "replacement"
  | "unavailable-provider";
