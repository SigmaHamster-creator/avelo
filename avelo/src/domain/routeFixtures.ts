/**
 * Deterministic demo route and pricing fixtures (Task 2.1).
 *
 * These are NOT live distance/traffic data. They are a small, documented
 * lookup table standing in for a real routing/pricing service in this
 * hackathon MVP. Every number here is fixed and reproducible.
 */
import type { DistanceTierFixture, Mobility } from "./types";

export const ROUTE_FIXTURES: Record<DistanceTierFixture["tier"], DistanceTierFixture> = {
  short: { tier: "short", travelDurationMinutes: 15, baseFarePerLeg: 18 },
  medium: { tier: "medium", travelDurationMinutes: 35, baseFarePerLeg: 32 },
  long: { tier: "long", travelDurationMinutes: 60, baseFarePerLeg: 52 },
  "rural-long": { tier: "rural-long", travelDurationMinutes: 90, baseFarePerLeg: 75 },
};

/** Fixed prep/arrival buffer used by PickupTimeCalculator, in minutes. */
export const ARRIVAL_BUFFER_MINUTES = 30;

export type VehicleAccessibilityCategory = "standard" | "wheelchair-accessible";

export const ACCESSIBILITY_MULTIPLIER: Record<VehicleAccessibilityCategory, number> = {
  standard: 1.0,
  "wheelchair-accessible": 1.4,
};

export function accessibilityCategoryFor(mobility: Mobility): VehicleAccessibilityCategory {
  return mobility === "must-remain-in-wheelchair" ? "wheelchair-accessible" : "standard";
}

/**
 * Resolve a deterministic distance tier for a fictional address pair.
 * This is a simple, documented hash over the two addresses so the same
 * pair always resolves to the same tier (reproducible demo behavior),
 * not a claim of real distance measurement.
 */
export function resolveDistanceTier(addressA: string, addressB: string): DistanceTierFixture {
  const key = `${addressA.trim().toLowerCase()}|${addressB.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const tiers: DistanceTierFixture["tier"][] = ["short", "medium", "long", "rural-long"];
  const tier = tiers[hash % tiers.length];
  return ROUTE_FIXTURES[tier];
}
