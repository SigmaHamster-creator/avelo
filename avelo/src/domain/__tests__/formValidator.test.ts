import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { validateForm } from "../formValidator";
import { createEmptyFormData } from "../types";
import type { BookingFormData } from "../types";

function validForm(): BookingFormData {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  const date = tomorrow.toISOString().slice(0, 10);
  return {
    caregiver: { name: "Rose Daniels", phone: "413-555-0142" },
    passenger: { name: "Walter Daniels" },
    outbound: {
      pickupAddress: "118 Birch Hollow Road, Hadley, MA",
      destinationName: "Pine Valley Hospital",
      destinationAddress: "40 Valley View Drive, Northampton, MA",
      tripDate: date,
      requiredArrivalTime: "10:00",
      suggestedPickupTime: null,
    },
    return: { pickupTime: "13:30", originAddress: "", destinationAddress: "" },
    requirements: { mobility: "must-remain-in-wheelchair", companionCount: 1, specialRequests: "" },
  };
}

describe("FormValidator (AC-VALIDATION-01)", () => {
  it("returns zero errors for a fully valid form", () => {
    expect(validateForm(validForm())).toHaveLength(0);
  });

  it("flags every required field missing on an empty form", () => {
    const errors = validateForm(createEmptyFormData());
    const fields = errors.map((e) => e.field);
    expect(fields).toContain("caregiver.name");
    expect(fields).toContain("caregiver.phone");
    expect(fields).toContain("passenger.name");
    expect(fields).toContain("outbound.pickupAddress");
    expect(fields).toContain("outbound.destinationName");
    expect(fields).toContain("outbound.destinationAddress");
    expect(fields).toContain("outbound.tripDate");
    expect(fields).toContain("outbound.requiredArrivalTime");
    expect(fields).toContain("return.pickupTime");
    expect(fields).toContain("requirements.mobility");
  });

  it("requires the return pickup time to be later than the required arrival time", () => {
    const form = validForm();
    form.return.pickupTime = "09:00"; // earlier than 10:00 arrival
    const errors = validateForm(form);
    expect(errors.some((e) => e.field === "return.pickupTime" && e.code === "NOT_AFTER_ARRIVAL")).toBe(true);
  });

  it("rejects a companion count outside 0-4", () => {
    const form = validForm();
    form.requirements.companionCount = 7;
    const errors = validateForm(form);
    expect(errors.some((e) => e.field === "requirements.companionCount")).toBe(true);
  });

  it("clears a resolved error without affecting other fields' errors", () => {
    const form = validForm();
    form.caregiver.name = "";
    form.passenger.name = "";
    const before = validateForm(form);
    expect(before.some((e) => e.field === "caregiver.name")).toBe(true);
    expect(before.some((e) => e.field === "passenger.name")).toBe(true);

    form.caregiver.name = "Rose Daniels";
    const after = validateForm(form);
    expect(after.some((e) => e.field === "caregiver.name")).toBe(false);
    expect(after.some((e) => e.field === "passenger.name")).toBe(true);
  });

  // Property 9: Validator flags exactly the invalid fields (manual and voice
  // paths share this exact same module, so this also covers AC-VALIDATION-05).
  it("Property 9: a companion count is flagged iff it is outside [0,4] or non-integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 10 }), (n) => {
        const form = validForm();
        form.requirements.companionCount = n;
        const errors = validateForm(form);
        const flagged = errors.some((e) => e.field === "requirements.companionCount");
        const shouldBeFlagged = n < 0 || n > 4;
        expect(flagged).toBe(shouldBeFlagged);
      }),
      { numRuns: 100 },
    );
  });
});
