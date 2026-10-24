---
inclusion: fileMatch
fileMatchPattern: 'src/domain/{fieldMergeEngine,voiceExtractionAdapter}*'
---

# Voice / manual field-merge semantics

Any code touching `FieldMergeEngine`, `VoiceExtractionAdapter`, or `BookingProvider`'s patch-application logic must
preserve these rules exactly (see `.kiro/specs/avelo/design.md`, "Voice Extraction and Field Merge Rules"):

1. **Latest input wins for every field it mentions.** Fields not mentioned in the latest input must be preserved.
   The user never has to say "change" or "update."
2. **Missing properties mean "no change."** Omitting a field from a patch must never be interpreted as clearing
   it. Only an explicit deletion marker (`{ __clear: true }`) or a manual clear action may clear a field.
3. **Empty or failed extraction must never reset the form.** A clarification response carries an empty patch,
   which is a guaranteed no-op.
4. **Resolve the correct trip leg from context.** "Pick her up from the hospital at 4 PM" is the ride home and must
   update `return.pickupTime`, not `outbound.requiredArrivalTime`. If a detail's leg or field cannot be determined,
   leave that detail out of the patch and ask a focused English clarifying question. Details in the same utterance
   that are unambiguous may still be applied.
5. **Explicit uncertainty blocks a definite value.** A statement like "three or four, not sure" must never become
   a definite time -- route it to a clarification instead.
6. **A clear self-correction within one utterance uses the final stated value.**
7. **Relative dates resolve against an explicit `nowISO` in America/New_York**, and the resolved date is echoed
   back for caregiver confirmation.
8. **Never invent an unspecified "home" address or an unspecified hospital name.**
9. **Voice input never auto-submits the booking.** Submission is reachable only from an explicit "Request
   Arrangement" click.
10. **Stale AI responses must never overwrite a newer edit.** Use the field-level `editVersion`/`fieldVersions`
    rebase in `FieldMergeEngine` -- a late response only applies to fields that have not themselves been edited
    more recently.
11. **The deterministic fallback extractor is not an AI model.** Always tag its output `source:
    "deterministic-fallback"` and never represent it as a real model call in UI copy or comments.

When adding or modifying extraction/merge code, write or update a property-based test asserting the relevant rule
above rather than only a single example-based test.
