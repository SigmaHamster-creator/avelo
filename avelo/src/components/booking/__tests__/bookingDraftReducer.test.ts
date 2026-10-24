import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { bookingDraftReducer, createInitialDraftState } from "../BookingProvider";

describe("bookingDraftReducer", () => {
  it("AC-FORM-01: return-leg addresses default from the outbound leg until explicitly overridden", () => {
    let state = createInitialDraftState();
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationAddress", value: "40 Valley View Dr" });
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.pickupAddress", value: "118 Birch Hollow Rd" });

    expect(state.form.return.originAddress).toBe("40 Valley View Dr");
    expect(state.form.return.destinationAddress).toBe("118 Birch Hollow Rd");

    // Override the return origin explicitly.
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "return.originAddress", value: "A different address" });
    // A further outbound edit must never revert the override.
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationAddress", value: "Somewhere else" });
    expect(state.form.return.originAddress).toBe("A different address");
    // The non-overridden return destination still tracks the outbound pickup.
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.pickupAddress", value: "New pickup" });
    expect(state.form.return.destinationAddress).toBe("New pickup");
  });

  // Property 20: Return-leg defaults derive from the outbound leg until overridden.
  it("Property 20: once overridden, outbound edits never change the return field again", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (overrideValue, outboundValue1, outboundValue2) => {
        let state = createInitialDraftState();
        state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationAddress", value: outboundValue1 });
        expect(state.form.return.originAddress).toBe(outboundValue1);

        state = bookingDraftReducer(state, { type: "SET_FIELD", field: "return.originAddress", value: overrideValue });
        state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationAddress", value: outboundValue2 });
        expect(state.form.return.originAddress).toBe(overrideValue);
      }),
      { numRuns: 50 },
    );
  });

  it("a manual edit after a voice patch is not reverted by undo-last-voice-update", () => {
    let state = createInitialDraftState();
    state = bookingDraftReducer(state, {
      type: "APPLY_PATCH",
      patch: { return: { pickupTime: "16:00" } },
      patchEditVersion: 0,
      transcript: "pick her up at 4pm",
    });
    expect(state.lastUpdateSummary).toBe("Updated the return pickup time.");
    expect(state.form.return.pickupTime).toBe("16:00");

    // Manual edit after the voice patch.
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "requirements.companionCount", value: 2 });

    state = bookingDraftReducer(state, { type: "UNDO_LAST_VOICE" });
    expect(state.form.return.pickupTime).toBe(""); // reverted (untouched since the voice patch)
    expect(state.form.requirements.companionCount).toBe(2); // manual edit preserved
  });
});
