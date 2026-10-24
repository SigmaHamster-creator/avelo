import { describe, expect, it } from "vitest";
import { bookingDraftReducer, createInitialDraftState } from "../BookingProvider";
import { findHospital, findHospitalMention } from "@/domain/hospitalDirectory";

describe("hospital directory", () => {
  it("matches names and aliases regardless of case and 'the'", () => {
    expect(findHospital("pine valley hospital")?.address).toBe("40 Valley View Drive, Northampton, MA");
    expect(findHospital("The Pine Valley")?.name).toBe("Pine Valley Hospital");
    expect(findHospital("Somewhere General")).toBeNull();
  });

  it("finds the last hospital mentioned in free text", () => {
    expect(findHospitalMention("first pine valley, no wait, quabbin regional")?.hospital.name).toBe("Quabbin Regional Medical Center");
  });
});

describe("hospital address autofill (shared by manual and voice input)", () => {
  it("typing a known hospital fills its address and the return pickup address", () => {
    let state = createInitialDraftState();
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationName", value: "Pine Valley Hospital" });
    expect(state.form.outbound.destinationAddress).toBe("40 Valley View Drive, Northampton, MA");
    expect(state.form.return.originAddress).toBe("40 Valley View Drive, Northampton, MA");
    expect(state.destinationAddressAuto).toBe(true);
  });

  it("a voice patch naming a known hospital fills its address, and undo reverts both", () => {
    let state = createInitialDraftState();
    state = bookingDraftReducer(state, {
      type: "APPLY_PATCH",
      patch: { outbound: { destinationName: "Quabbin Regional Medical Center" } },
      patchEditVersion: 0,
      transcript: "take her to quabbin regional",
    });
    expect(state.form.outbound.destinationAddress).toBe("500 Ridgefield Road, Belchertown, MA");
    expect(state.lastUpdateSummary).toContain("demo hospital directory");

    state = bookingDraftReducer(state, { type: "UNDO_LAST_VOICE" });
    expect(state.form.outbound.destinationName).toBe("");
    expect(state.form.outbound.destinationAddress).toBe("");
  });

  it("switching hospitals replaces an auto-filled address", () => {
    let state = createInitialDraftState();
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationName", value: "Pine Valley Hospital" });
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationName", value: "Maple Ridge Medical Center" });
    expect(state.form.outbound.destinationAddress).toBe("12 Orchard Hill Road, Greenfield, MA");
  });

  it("switching to an unknown hospital clears an auto-filled address instead of leaving the old one", () => {
    let state = createInitialDraftState();
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationName", value: "Pine Valley Hospital" });
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationName", value: "Some Other Clinic" });
    expect(state.form.outbound.destinationAddress).toBe("");
  });

  it("never overwrites an address the caregiver typed themselves", () => {
    let state = createInitialDraftState();
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationAddress", value: "1 Custom Way" });
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationName", value: "Pine Valley Hospital" });
    expect(state.form.outbound.destinationAddress).toBe("1 Custom Way");
    expect(state.destinationAddressAuto).toBe(false);
  });

  it("marks a held estimate stale when the address is auto-filled", () => {
    let state = createInitialDraftState();
    state = { ...state, estimate: { outboundEstimate: 1, returnEstimate: 1, total: 2, specialRequestPending: false, suggestedPickupTime: "08:00", explanation: "" } };
    state = bookingDraftReducer(state, { type: "SET_FIELD", field: "outbound.destinationName", value: "Pine Valley Hospital" });
    expect(state.estimateStale).toBe(true);
  });
});
