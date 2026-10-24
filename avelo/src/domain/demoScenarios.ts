/**
 * Demo scenario fixtures (Tasks 3.7, 5.1, 5.2, 6.2, 7.6).
 *
 * All names, addresses, and providers below are fictional, used only to
 * demonstrate the booking flow deterministically and repeatably. Nothing
 * here represents a real person, address, or transportation company.
 */
import type { BookingFormData, DemoScenarioId } from "./types";
import type { CandidateProviderFixture } from "./matchingSimulator";

export interface ScenarioFixture {
  id: DemoScenarioId;
  form: BookingFormData;
  candidate: CandidateProviderFixture;
  outcome: "same-price" | "revised-price" | "unmatched";
  revision?: { amountDelta: number; reason: string };
  /** Fixed, non-random simulated search delay in milliseconds. */
  searchDelayMs: number;
  replacementCandidate?: CandidateProviderFixture;
}

function form(overrides: Partial<BookingFormData>): BookingFormData {
  const base: BookingFormData = {
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
    requirements: { mobility: "can-transfer", companionCount: 0, specialRequests: "" },
  };
  return {
    ...base,
    ...overrides,
    caregiver: { ...base.caregiver, ...overrides.caregiver },
    passenger: { ...base.passenger, ...overrides.passenger },
    outbound: { ...base.outbound, ...overrides.outbound },
    return: { ...base.return, ...overrides.return },
    requirements: { ...base.requirements, ...overrides.requirements },
  };
}

/** Returns the next date (YYYY-MM-DD) that is at least `daysAhead` from today. */
function upcomingDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const STANDARD: ScenarioFixture = {
  id: "standard",
  form: form({
    caregiver: { name: "Rose Daniels", phone: "413-555-0142" },
    passenger: { name: "Walter Daniels" },
    outbound: {
      pickupAddress: "118 Birch Hollow Road, Hadley, MA",
      destinationName: "Pine Valley Hospital",
      destinationAddress: "40 Valley View Drive, Northampton, MA",
      tripDate: upcomingDate(3),
      requiredArrivalTime: "10:00",
      suggestedPickupTime: null,
    },
    return: { pickupTime: "13:30", originAddress: "", destinationAddress: "" },
    requirements: { mobility: "must-remain-in-wheelchair", companionCount: 1, specialRequests: "" },
  }),
  candidate: {
    name: "Pioneer Valley Rides",
    vehicleType: "Wheelchair-accessible minivan",
    accessibilityEquipment: ["Fold-out ramp", "Wheelchair securement straps"],
    servesWheelchair: true,
    maxCompanions: 2,
    serviceAreaKeywords: [],
  },
  outcome: "same-price",
  searchDelayMs: 2000,
};

const SPECIAL_REQUEST_REVISION: ScenarioFixture = {
  id: "special-request-revision",
  form: form({
    caregiver: { name: "Linda Ortiz", phone: "413-555-0199" },
    passenger: { name: "Marco Ortiz" },
    outbound: {
      pickupAddress: "27 Sugar Maple Lane, Amherst, MA",
      destinationName: "Quabbin Regional Medical Center",
      destinationAddress: "500 Ridgefield Road, Belchertown, MA",
      tripDate: upcomingDate(4),
      requiredArrivalTime: "09:30",
      suggestedPickupTime: null,
    },
    return: { pickupTime: "12:00", originAddress: "", destinationAddress: "" },
    requirements: {
      mobility: "can-transfer",
      companionCount: 1,
      specialRequests: "Needs help carrying a portable oxygen tank on and off the vehicle.",
    },
  }),
  candidate: {
    name: "Hilltown Medical Rides",
    vehicleType: "Standard accessible sedan",
    accessibilityEquipment: ["Grab handles", "Low-step entry"],
    servesWheelchair: false,
    maxCompanions: 2,
    serviceAreaKeywords: [],
  },
  outcome: "revised-price",
  revision: { amountDelta: 15, reason: "additional assistance for medical equipment (portable oxygen tank)" },
  searchDelayMs: 2000,
};

const REPLACEMENT: ScenarioFixture = {
  id: "replacement",
  form: STANDARD.form,
  candidate: STANDARD.candidate,
  outcome: "same-price",
  searchDelayMs: 2000,
  replacementCandidate: {
    name: "Berkshire Accessible Transport",
    vehicleType: "Wheelchair-accessible van",
    accessibilityEquipment: ["Power lift", "Wheelchair securement straps"],
    servesWheelchair: true,
    maxCompanions: 2,
    serviceAreaKeywords: [],
  },
};

const UNAVAILABLE_PROVIDER: ScenarioFixture = {
  id: "unavailable-provider",
  form: form({
    caregiver: { name: "Diane Marsh", phone: "413-555-0176" },
    passenger: { name: "Harold Marsh" },
    outbound: {
      pickupAddress: "9 Quarry Ridge Road, Shelburne Falls, MA",
      destinationName: "Berkshire County Medical Center",
      destinationAddress: "210 Mountain Pass Road, North Adams, MA",
      tripDate: upcomingDate(5),
      requiredArrivalTime: "11:00",
      suggestedPickupTime: null,
    },
    return: { pickupTime: "14:00", originAddress: "", destinationAddress: "" },
    requirements: { mobility: "must-remain-in-wheelchair", companionCount: 3, specialRequests: "" },
  }),
  candidate: {
    name: "Franklin County Rides",
    vehicleType: "Wheelchair-accessible minivan",
    accessibilityEquipment: ["Fold-out ramp"],
    servesWheelchair: true,
    maxCompanions: 2, // 3 companions requested exceeds this capacity on purpose
    serviceAreaKeywords: [],
  },
  outcome: "unmatched",
  searchDelayMs: 2000,
};

export const SCENARIOS: Record<DemoScenarioId, ScenarioFixture> = {
  standard: STANDARD,
  "special-request-revision": SPECIAL_REQUEST_REVISION,
  replacement: REPLACEMENT,
  "unavailable-provider": UNAVAILABLE_PROVIDER,
};

export const DEFAULT_SCENARIO_ID: DemoScenarioId = "standard";
