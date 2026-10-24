import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { applyPatch, isEmptyPatch } from "../fieldMergeEngine";
import { createEmptyFormData } from "../types";
import type { BookingFormData, FieldPath, FormFieldPatch } from "../types";

function baseForm(): BookingFormData {
  const form = createEmptyFormData();
  form.outbound.destinationName = "City Hospital";
  form.return.pickupTime = "15:00";
  form.passenger.name = "Grandma";
  return form;
}

describe("FieldMergeEngine", () => {
  it("AC-VOICE-01: a follow-up patch updates only the mentioned hospital and time fields", () => {
    const form = baseForm();
    const patch: FormFieldPatch = {
      outbound: { destinationName: "Pine Valley Hospital" },
      return: { pickupTime: "16:00" },
    };
    const result = applyPatch(form, 1, patch, 1, {});

    expect(result.draft.outbound.destinationName).toBe("Pine Valley Hospital");
    expect(result.draft.return.pickupTime).toBe("16:00");
    expect(result.draft.passenger.name).toBe("Grandma"); // unrelated field untouched
    expect(result.appliedFields.sort()).toEqual(["outbound.destinationName", "return.pickupTime"].sort());
  });

  it("omission preserves a field even when the top-level sub-object is mentioned", () => {
    const form = baseForm();
    const patch: FormFieldPatch = { outbound: { requiredArrivalTime: "09:00" } };
    const result = applyPatch(form, 1, patch, 1, {});
    expect(result.draft.outbound.destinationName).toBe("City Hospital"); // not mentioned, preserved
    expect(result.draft.outbound.requiredArrivalTime).toBe("09:00");
  });

  it("an explicit __clear marker clears exactly that field", () => {
    const form = baseForm();
    const patch: FormFieldPatch = { requirements: { specialRequests: { __clear: true } } };
    form.requirements.specialRequests = "needs oxygen tank help";
    const result = applyPatch(form, 1, patch, 1, {});
    expect(result.draft.requirements.specialRequests).toBe("");
    expect(result.draft.passenger.name).toBe("Grandma");
  });

  it("an empty patch (clarification response) is a guaranteed no-op", () => {
    const form = baseForm();
    expect(isEmptyPatch({})).toBe(true);
    const result = applyPatch(form, 1, {}, 1, {});
    expect(result.draft).toEqual(form);
    expect(result.appliedFields).toHaveLength(0);
  });

  it("a stale patch never regresses a field already touched by a newer edit", () => {
    const form = baseForm();
    const fieldVersions: Record<string, number> = { "return.pickupTime": 5 };
    // Patch captured when draft was at version 1, arriving after the draft
    // advanced to version 5 (because return.pickupTime was edited again).
    const patch: FormFieldPatch = { return: { pickupTime: "16:00" } };
    const result = applyPatch(form, 5, patch, 1, fieldVersions);

    expect(result.rejectedStaleFields).toContain("return.pickupTime");
    expect(result.draft.return.pickupTime).toBe("15:00"); // unchanged, not regressed
  });

  it("a field last edited before capture started is not treated as stale", () => {
    const form = baseForm();
    // pickupTime was edited at version 3, capture started at version 3, an
    // unrelated edit then moved the draft to version 4.
    const fieldVersions: Record<string, number> = { "return.pickupTime": 3, "passenger.name": 4 };
    const result = applyPatch(form, 4, { return: { pickupTime: "16:00" } }, 3, fieldVersions);
    expect(result.rejectedStaleFields).toHaveLength(0);
    expect(result.draft.return.pickupTime).toBe("16:00");
  });

  it("a stale patch still applies to fields NOT touched more recently", () => {
    const form = baseForm();
    const fieldVersions: Record<string, number> = { "return.pickupTime": 5 };
    const patch: FormFieldPatch = {
      return: { pickupTime: "16:00" },
      passenger: { name: "New Name" },
    };
    const result = applyPatch(form, 5, patch, 1, fieldVersions);

    expect(result.rejectedStaleFields).toContain("return.pickupTime");
    expect(result.appliedFields).toContain("passenger.name");
    expect(result.draft.passenger.name).toBe("New Name");
    expect(result.draft.return.pickupTime).toBe("15:00");
  });

  // Property 1: Patch mentions govern change, omission preserves, explicit clear removes.
  it("Property 1: only mentioned leaf fields ever change", () => {
    const allFields: FieldPath[] = [
      "caregiver.name",
      "caregiver.phone",
      "passenger.name",
      "outbound.pickupAddress",
      "outbound.destinationName",
      "outbound.destinationAddress",
      "outbound.tripDate",
      "outbound.requiredArrivalTime",
      "return.pickupTime",
      "return.originAddress",
      "return.destinationAddress",
      "requirements.companionCount",
      "requirements.specialRequests",
    ];

    fc.assert(
      fc.property(fc.subarray(allFields, { minLength: 0, maxLength: allFields.length }), fc.string(), (mentionedFields, value) => {
        const form = baseForm();
        const patch: FormFieldPatch = {};
        for (const field of mentionedFields) {
          const [top, sub] = field.split(".") as [keyof FormFieldPatch, string];
          (patch as Record<string, Record<string, unknown>>)[top] = {
            ...((patch as Record<string, Record<string, unknown>>)[top] ?? {}),
            [sub]: value,
          };
        }

        const result = applyPatch(form, 1, patch, 1, {});
        for (const field of allFields) {
          const wasMentioned = mentionedFields.includes(field);
          const [top, sub] = field.split(".") as [keyof BookingFormData, string];
          const before = (form[top] as unknown as Record<string, unknown>)[sub];
          const after = (result.draft[top] as unknown as Record<string, unknown>)[sub];
          if (wasMentioned) {
            expect(after).toBe(value);
          } else {
            expect(after).toBe(before);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 2: Latest edit wins on overlapping fields regardless of source.
  it("Property 2: applying two sequential patches, the later one wins per mentioned field", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (first, second) => {
        const form = baseForm();
        const r1 = applyPatch(form, 1, { passenger: { name: first } }, 1, {});
        const fieldVersions = { "passenger.name": 2 };
        const r2 = applyPatch(r1.draft, 2, { passenger: { name: second } }, 2, fieldVersions);
        expect(r2.draft.passenger.name).toBe(second);
      }),
      { numRuns: 50 },
    );
  });

  // Property 6: Stale responses never regress newer edits.
  it("Property 6: a field touched after the patch's base version is never overwritten by that patch", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), fc.integer({ min: 2, max: 10 }), (newerValue, staleValue, newerVersion) => {
        const form = baseForm();
        form.passenger.name = newerValue;
        const fieldVersions = { "passenger.name": newerVersion };
        const result = applyPatch(form, newerVersion, { passenger: { name: staleValue } }, 1, fieldVersions);
        expect(result.draft.passenger.name).toBe(newerValue);
        expect(result.rejectedStaleFields).toContain("passenger.name");
      }),
      { numRuns: 50 },
    );
  });
});
