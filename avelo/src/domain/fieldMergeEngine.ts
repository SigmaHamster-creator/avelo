/**
 * FieldMergeEngine (Task 4.1 + 4.12): applies a FormFieldPatch to a form
 * draft per the exact merge semantics required by the product brief.
 *
 *  1. Mentioned-only update: a leaf key present in the patch with a
 *     concrete value replaces that field. Any leaf not present anywhere in
 *     the patch is left byte-identical.
 *  2. Missing = no-op: omission is never "clear this field." Only the
 *     explicit `{ __clear: true }` marker clears a field (to its empty
 *     value).
 *  3. Versioning/rebase: every draft carries a monotonic `editVersion`. A
 *     patch also carries the `patchEditVersion` it was computed against
 *     (the draft's `editVersion` at the moment voice capture started). If a
 *     field has been touched by an edit that happened at or after the
 *     patch's base version (i.e. a newer edit already exists for that
 *     field), the patch's change for that field is dropped and reported in
 *     `rejectedStaleFields` -- never applied, never regressing a newer
 *     edit. Fields the patch mentions that have NOT been touched more
 *     recently are still applied, even if the overall draft has moved on.
 *
 * To support per-field "touched since" tracking, callers pass a
 * `fieldVersions` map (field path -> editVersion at which it was last
 * changed). This map is maintained by BookingStore.
 */
import type { BookingFormData, FieldPath, FormFieldPatch, MergeResult } from "./types";
import { isClearMarker } from "./types";

export type FieldVersions = Partial<Record<FieldPath, number>>;

const EMPTY_VALUE: Record<string, unknown> = {
  "caregiver.name": "",
  "caregiver.phone": "",
  "passenger.name": "",
  "outbound.pickupAddress": "",
  "outbound.destinationName": "",
  "outbound.destinationAddress": "",
  "outbound.tripDate": "",
  "outbound.requiredArrivalTime": "",
  "return.pickupTime": "",
  "return.originAddress": "",
  "return.destinationAddress": "",
  "requirements.mobility": null,
  "requirements.companionCount": 0,
  "requirements.specialRequests": "",
};

function flattenPatch(patch: FormFieldPatch): Partial<Record<FieldPath, unknown>> {
  const out: Partial<Record<FieldPath, unknown>> = {};
  for (const topKey of Object.keys(patch) as (keyof FormFieldPatch)[]) {
    const sub = patch[topKey] as Record<string, unknown> | undefined;
    if (!sub) continue;
    for (const subKey of Object.keys(sub)) {
      out[`${topKey}.${subKey}` as FieldPath] = sub[subKey];
    }
  }
  return out;
}

function setField(draft: BookingFormData, field: FieldPath, value: unknown): BookingFormData {
  const [top, sub] = field.split(".") as [keyof BookingFormData, string];
  return {
    ...draft,
    [top]: {
      ...(draft[top] as unknown as Record<string, unknown>),
      [sub]: value,
    },
  };
}

/**
 * Applies `patch` (captured against `patchEditVersion`) onto `draft`
 * (currently at `draftEditVersion`), using `fieldVersions` to decide, per
 * field, whether a newer edit already superseded the patch's value for
 * that field.
 */
export function applyPatch(
  draft: BookingFormData,
  draftEditVersion: number,
  patch: FormFieldPatch,
  patchEditVersion: number,
  fieldVersions: FieldVersions = {},
): MergeResult {
  const flat = flattenPatch(patch);
  let nextDraft = draft;
  const appliedFields: FieldPath[] = [];
  const rejectedStaleFields: FieldPath[] = [];

  for (const field of Object.keys(flat) as FieldPath[]) {
    const rawValue = flat[field];
    const lastTouchedAt = fieldVersions[field] ?? 0;

    // A field is "stale" for this patch if it was touched by an edit that
    // happened at or after this patch's base version -- i.e. a newer edit
    // already exists for this specific field, even if the draft overall
    // has advanced for unrelated reasons.
    // Strictly greater: an edit made AT the base version happened before
    // capture started, so it is the value the patch was meant to replace.
    const isStale = draftEditVersion > patchEditVersion && lastTouchedAt > patchEditVersion;

    if (isStale) {
      rejectedStaleFields.push(field);
      continue;
    }

    const value = isClearMarker(rawValue) ? EMPTY_VALUE[field] : rawValue;
    nextDraft = setField(nextDraft, field, value);
    appliedFields.push(field);
  }

  return { draft: nextDraft, appliedFields, rejectedStaleFields };
}

/** True when a patch applies to nothing (e.g. a clarification response). */
export function isEmptyPatch(patch: FormFieldPatch): boolean {
  return Object.keys(flattenPatch(patch)).length === 0;
}
