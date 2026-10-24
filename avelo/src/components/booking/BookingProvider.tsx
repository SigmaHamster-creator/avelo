"use client";

/**
 * BookingProvider: the single client-side source of truth for the
 * in-progress booking draft. Manual edits and voice/typed patches both go
 * through the same FieldMergeEngine + FormValidator modules (isomorphic,
 * shared with the server) so behavior is identical regardless of input
 * method (Requirement 51). See src/server/bookingStore.ts for the
 * documented reasoning behind keeping the pre-submission draft here
 * rather than in a server-side session store.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import { applyPatch, type FieldVersions } from "@/domain/fieldMergeEngine";
import { validateForm } from "@/domain/formValidator";
import { summarizeChangedFields } from "@/components/voice/fieldLabels";
import { findHospital } from "@/domain/hospitalDirectory";
import {
  createEmptyFormData,
  type BookingFormData,
  type DemoScenarioId,
  type EstimateResult,
  type FieldPath,
  type FormFieldPatch,
  type ValidationError,
} from "@/domain/types";

const RELEVANT_TO_ESTIMATE: FieldPath[] = [
  "outbound.pickupAddress",
  "outbound.destinationAddress",
  "outbound.tripDate",
  "outbound.requiredArrivalTime",
  "requirements.mobility",
  "requirements.companionCount",
];

const STORAGE_KEY = "avelo.draft.v1";

interface DraftState {
  form: BookingFormData;
  editVersion: number;
  fieldVersions: FieldVersions;
  returnOverrides: { originAddress: boolean; destinationAddress: boolean };
  /** True while outbound.destinationAddress holds an address filled in from the demo hospital directory. */
  destinationAddressAuto: boolean;
  estimate: EstimateResult | null;
  estimateStale: boolean;
  scenarioId: DemoScenarioId;
  bookingId: string | null;
  transcript: string;
  lastChangedFields: FieldPath[];
  lastUpdateSummary: string | null;
  lastVoicePatch: { fields: FieldPath[]; priorValues: Partial<Record<FieldPath, unknown>>; atEditVersion: number } | null;
}

function initialState(): DraftState {
  return {
    form: createEmptyFormData(),
    editVersion: 0,
    fieldVersions: {},
    returnOverrides: { originAddress: false, destinationAddress: false },
    destinationAddressAuto: false,
    estimate: null,
    estimateStale: false,
    scenarioId: "standard",
    bookingId: null,
    transcript: "",
    lastChangedFields: [],
    lastUpdateSummary: null,
    lastVoicePatch: null,
  };
}

function getField(form: BookingFormData, field: FieldPath): unknown {
  const [top, sub] = field.split(".") as [keyof BookingFormData, string];
  return (form[top] as unknown as Record<string, unknown>)[sub];
}

function setFieldValue(form: BookingFormData, field: FieldPath, value: unknown): BookingFormData {
  const [top, sub] = field.split(".") as [keyof BookingFormData, string];
  return { ...form, [top]: { ...(form[top] as unknown as Record<string, unknown>), [sub]: value } };
}

type Action =
  | { type: "SET_FIELD"; field: FieldPath; value: unknown }
  | { type: "APPLY_PATCH"; patch: FormFieldPatch; patchEditVersion: number; transcript: string; note?: string }
  | { type: "SET_ESTIMATE"; estimate: EstimateResult }
  | { type: "LOAD_SCENARIO"; form: BookingFormData; scenarioId: DemoScenarioId }
  | { type: "SET_BOOKING_ID"; bookingId: string | null }
  | { type: "UNDO_LAST_VOICE" }
  | { type: "RESET" }
  | { type: "HYDRATE"; state: DraftState };

function markStaleIfRelevant(fields: FieldPath[], estimateStale: boolean): boolean {
  if (estimateStale) return true;
  return fields.some((f) => RELEVANT_TO_ESTIMATE.includes(f));
}

const ALL_FIELDS: FieldPath[] = [
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
  "requirements.mobility",
  "requirements.companionCount",
  "requirements.specialRequests",
];

function diffFields(before: BookingFormData, after: BookingFormData): FieldPath[] {
  return ALL_FIELDS.filter((f) => getField(before, f) !== getField(after, f));
}

interface DerivedResult {
  form: BookingFormData;
  overrides: DraftState["returnOverrides"];
  destinationAddressAuto: boolean;
  /** Plain-English note when a hospital address was filled in. */
  note?: string;
}

/**
 * Follow-on rules applied identically after manual edits and voice patches:
 *  1. Naming a hospital in the demo directory fills its destination address,
 *     unless the caregiver supplied a destination address themselves.
 *     Switching to an unknown hospital clears an address that was only
 *     auto-filled, so an old hospital's address is never left behind.
 *  2. Return-leg addresses default from the outbound leg until overridden.
 */
function applyDerivedRules(prev: DraftState, edited: BookingFormData, editedFields: FieldPath[]): DerivedResult {
  let form = edited;
  let overrides = prev.returnOverrides;
  let destinationAddressAuto = prev.destinationAddressAuto;
  let note: string | undefined;

  if (editedFields.includes("return.originAddress")) overrides = { ...overrides, originAddress: true };
  if (editedFields.includes("return.destinationAddress")) overrides = { ...overrides, destinationAddress: true };

  if (editedFields.includes("outbound.destinationAddress")) {
    destinationAddressAuto = false; // the caregiver gave this address explicitly
  } else if (editedFields.includes("outbound.destinationName")) {
    const hospital = findHospital(form.outbound.destinationName);
    const addressIsFree = form.outbound.destinationAddress.trim() === "" || prev.destinationAddressAuto;
    if (hospital && addressIsFree) {
      if (form.outbound.destinationName !== hospital.name || form.outbound.destinationAddress !== hospital.address) {
        note = `Filled in the address for ${hospital.name} from Avelo's demo hospital directory.`;
      }
      form = setFieldValue(form, "outbound.destinationAddress", hospital.address);
      destinationAddressAuto = true;
    } else if (!hospital && prev.destinationAddressAuto) {
      form = setFieldValue(form, "outbound.destinationAddress", "");
      destinationAddressAuto = false;
    }
  }

  if (form.outbound.destinationAddress !== prev.form.outbound.destinationAddress && !overrides.originAddress) {
    form = setFieldValue(form, "return.originAddress", form.outbound.destinationAddress);
  }
  if (form.outbound.pickupAddress !== prev.form.outbound.pickupAddress && !overrides.destinationAddress) {
    form = setFieldValue(form, "return.destinationAddress", form.outbound.pickupAddress);
  }

  return { form, overrides, destinationAddressAuto, note };
}

function reducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {
    case "SET_FIELD": {
      const nextVersion = state.editVersion + 1;
      const edited = setFieldValue(state.form, action.field, action.value);
      const derived = applyDerivedRules(state, edited, [action.field]);
      const changed = diffFields(state.form, derived.form);

      const fieldVersions = { ...state.fieldVersions, [action.field]: nextVersion };
      for (const field of changed) fieldVersions[field] = nextVersion;

      return {
        ...state,
        form: derived.form,
        editVersion: nextVersion,
        fieldVersions,
        returnOverrides: derived.overrides,
        destinationAddressAuto: derived.destinationAddressAuto,
        estimateStale: markStaleIfRelevant([action.field, ...changed], state.estimateStale),
        // Highlight only fields filled in automatically, not the one being typed.
        lastChangedFields: changed.filter((f) => f !== action.field),
      };
    }
    case "APPLY_PATCH": {
      const result = applyPatch(state.form, state.editVersion, action.patch, action.patchEditVersion, state.fieldVersions);
      const nextVersion = state.editVersion + 1;
      const derived = applyDerivedRules(state, result.draft, result.appliedFields);
      const changed = diffFields(state.form, derived.form);

      const fieldVersions = { ...state.fieldVersions };
      const priorValues: Partial<Record<FieldPath, unknown>> = {};
      for (const field of changed) {
        priorValues[field] = getField(state.form, field);
        fieldVersions[field] = nextVersion;
      }

      const summaryParts: string[] = [];
      if (changed.length > 0) summaryParts.push(summarizeChangedFields(changed));
      if (derived.note) summaryParts.push(derived.note);
      if (result.rejectedStaleFields.length > 0) {
        summaryParts.push("Some details were not applied because you edited them while Avelo was listening.");
      }
      if (action.note) summaryParts.push(action.note);
      if (summaryParts.length === 0) summaryParts.push("No changes were made.");

      return {
        ...state,
        form: derived.form,
        editVersion: nextVersion,
        fieldVersions,
        returnOverrides: derived.overrides,
        destinationAddressAuto: derived.destinationAddressAuto,
        estimateStale: markStaleIfRelevant(changed, state.estimateStale),
        transcript: action.transcript,
        lastChangedFields: changed,
        lastUpdateSummary: summaryParts.join(" "),
        lastVoicePatch: changed.length > 0 ? { fields: changed, priorValues, atEditVersion: nextVersion } : state.lastVoicePatch,
      };
    }
    case "SET_ESTIMATE":
      return { ...state, estimate: action.estimate, estimateStale: false };
    case "LOAD_SCENARIO": {
      const nextVersion = state.editVersion + 1;
      const fieldVersions: FieldVersions = {};
      return {
        ...initialState(),
        form: action.form,
        scenarioId: action.scenarioId,
        editVersion: nextVersion,
        fieldVersions,
        destinationAddressAuto: findHospital(action.form.outbound.destinationName)?.address === action.form.outbound.destinationAddress,
      };
    }
    case "SET_BOOKING_ID":
      return { ...state, bookingId: action.bookingId };
    case "UNDO_LAST_VOICE": {
      if (!state.lastVoicePatch) return state;
      let form = state.form;
      for (const field of state.lastVoicePatch.fields) {
        // Only revert a field if nothing has touched it since this voice patch.
        if ((state.fieldVersions[field] ?? 0) === state.lastVoicePatch.atEditVersion) {
          form = setFieldValue(form, field, state.lastVoicePatch.priorValues[field]);
        }
      }
      return { ...state, form, lastVoicePatch: null, lastChangedFields: [], lastUpdateSummary: "Undid the last voice update." };
    }
    case "RESET":
      return initialState();
    case "HYDRATE":
      // Older saved drafts may predate newer fields; fill in their defaults.
      return { ...initialState(), ...action.state };
    default:
      return state;
  }
}

interface BookingContextValue {
  state: DraftState;
  errors: ValidationError[];
  setField: (field: FieldPath, value: unknown) => void;
  applyVoicePatch: (patch: FormFieldPatch, patchEditVersion: number, transcript: string, note?: string) => void;
  setEstimate: (estimate: EstimateResult) => void;
  loadScenario: (form: BookingFormData, scenarioId: DemoScenarioId) => void;
  setBookingId: (bookingId: string | null) => void;
  undoLastVoiceUpdate: () => void;
  reset: () => Promise<void>;
  requestEpochRef: React.MutableRefObject<number>;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const hydrated = useRef(false);
  const requestEpochRef = useRef(0);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftState;
        dispatch({ type: "HYDRATE", state: parsed });
      }
    } catch {
      // Corrupt/absent storage is treated as a fresh, empty draft.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage may be unavailable (e.g. private browsing); draft still
      // works for the current page lifetime.
    }
  }, [state]);

  const setField = useCallback((field: FieldPath, value: unknown) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  const applyVoicePatch = useCallback(
    (patch: FormFieldPatch, patchEditVersion: number, transcript: string, note?: string) => {
      dispatch({ type: "APPLY_PATCH", patch, patchEditVersion, transcript, note });
    },
    [],
  );

  const setEstimate = useCallback((estimate: EstimateResult) => {
    dispatch({ type: "SET_ESTIMATE", estimate });
  }, []);

  const loadScenario = useCallback((form: BookingFormData, scenarioId: DemoScenarioId) => {
    requestEpochRef.current += 1;
    dispatch({ type: "LOAD_SCENARIO", form, scenarioId });
  }, []);

  const setBookingId = useCallback((bookingId: string | null) => {
    dispatch({ type: "SET_BOOKING_ID", bookingId });
  }, []);

  const undoLastVoiceUpdate = useCallback(() => {
    dispatch({ type: "UNDO_LAST_VOICE" });
  }, []);

  const reset = useCallback(async () => {
    requestEpochRef.current += 1; // invalidate any in-flight fetch for the prior session
    const bookingId = state.bookingId;
    try {
      await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
    } catch {
      // Reset proceeds client-side even if the network call fails.
    }
    dispatch({ type: "RESET" });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [state.bookingId]);

  const errors = useMemo(() => validateForm(state.form), [state.form]);

  const value = useMemo<BookingContextValue>(
    () => ({ state, errors, setField, applyVoicePatch, setEstimate, loadScenario, setBookingId, undoLastVoiceUpdate, reset, requestEpochRef }),
    [state, errors, setField, applyVoicePatch, setEstimate, loadScenario, setBookingId, undoLastVoiceUpdate, reset],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within a BookingProvider");
  return ctx;
}

export { RELEVANT_TO_ESTIMATE, reducer as bookingDraftReducer, initialState as createInitialDraftState };
export type { DraftState, Action as BookingDraftAction };
