import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DeterministicFallbackExtractor, normalizeTranscript, validateExtractedPatch } from "../voiceExtractionAdapter";
import { createEmptyFormData } from "../types";

const extractor = new DeterministicFallbackExtractor();
// Saturday, October 24, 2026, 10:00 AM in America/New_York.
const NOW = "2026-10-24T14:00:00Z";

function extract(transcript: string) {
  return extractor.extract({ transcript, currentFormSnapshot: createEmptyFormData(), nowISO: NOW });
}

describe("DeterministicFallbackExtractor", () => {
  it("is tagged as a deterministic fallback, never represented as a real model call", async () => {
    expect((await extract("Pick her up from Pine Valley Hospital at 4 PM")).source).toBe("deterministic-fallback");
  });

  it("normalizes browser speech output such as '4 p.m.'", () => {
    expect(normalizeTranscript("at 4 p.m. and 9:30 a.m.")).toBe("at 4 pm and 9:30 am");
  });

  it("AC-VOICE-01: 'pick her up FROM the hospital' sets the return pickup time and the hospital, not the arrival time", async () => {
    const result = await extract("Pick up my grandmother from Pine Valley Hospital at 4 p.m.");
    expect(result.patch.return?.pickupTime).toBe("16:00");
    expect(result.patch.outbound?.destinationName).toBe("Pine Valley Hospital");
    expect(result.patch.outbound?.requiredArrivalTime).toBeUndefined();
    expect(result.resolvedLeg).toBe("return");
  });

  it("recognizes a directory hospital without the word 'hospital' and uses its full name", async () => {
    const result = await extract("take her to quabbin regional by 9 a.m.");
    expect(result.patch.outbound?.destinationName).toBe("Quabbin Regional Medical Center");
    expect(result.patch.outbound?.requiredArrivalTime).toBe("09:00");
  });

  it("'pick her up from <directory hospital>' without a keyword is still the ride home", async () => {
    const result = await extract("pick her up from pine valley at 2 p.m.");
    expect(result.patch.outbound?.destinationName).toBe("Pine Valley Hospital");
    expect(result.patch.return?.pickupTime).toBe("14:00");
  });

  it("never invents a hospital name for a generic 'the hospital'", async () => {
    const result = await extract("Pick up my grandmother from the hospital at 3 PM");
    expect(result.patch.return?.pickupTime).toBe("15:00");
    expect(result.patch.outbound?.destinationName).toBeUndefined();
  });

  it("arrival wording sets the required arrival time (lowercase speech output)", async () => {
    const result = await extract("she needs to arrive at pine valley hospital by 10 a.m.");
    expect(result.patch.outbound?.requiredArrivalTime).toBe("10:00");
    expect(result.patch.outbound?.destinationName).toBe("Pine Valley Hospital");
    expect(result.patch.return).toBeUndefined();
  });

  it("assigns two times in one utterance to their own legs", async () => {
    const result = await extract("Get her to the clinic by 9:30 AM and pick her up at 1 PM");
    expect(result.patch.outbound?.requiredArrivalTime).toBe("09:30");
    expect(result.patch.return?.pickupTime).toBe("13:00");
  });

  it("a mid-utterance self-correction keeps only the final stated time", async () => {
    const result = await extract("She's coming home at 3 PM, actually make that 4 PM");
    expect(result.patch.return?.pickupTime).toBe("16:00");
  });

  it("asks a focused question instead of guessing when the leg is unclear", async () => {
    const result = await extract("Pick her up at 4 PM");
    expect(result.clarificationNeeded).toMatch(/arrive at the appointment, or the pickup time for the ride home/);
    expect(result.patch.outbound?.requiredArrivalTime).toBeUndefined();
    expect(result.patch.return?.pickupTime).toBeUndefined();
  });

  it("explicit uncertainty never becomes a definite time", async () => {
    for (const phrase of ["Pick her up at three or four, I'm not sure", "Bring her back at 3 or 4 PM"]) {
      const result = await extract(phrase);
      expect(result.clarificationNeeded).toBeTruthy();
      expect(result.patch.return?.pickupTime).toBeUndefined();
      expect(result.patch.outbound?.requiredArrivalTime).toBeUndefined();
    }
  });

  it("AC-VOICE-02: supplying only an address sets only that address", async () => {
    const result = await extract("Pick her up from 118 Birch Hollow Road in Hadley");
    expect(result.patch).toEqual({ outbound: { pickupAddress: "118 Birch Hollow Road, Hadley" } });
  });

  it("an address after a hospital mention is the destination address", async () => {
    const result = await extract("The hospital is at 40 Valley View Drive, Northampton, MA");
    expect(result.patch.outbound?.destinationAddress).toBe("40 Valley View Drive, Northampton, MA");
  });

  it("reads 'can't transfer' as must remain in the wheelchair", async () => {
    expect((await extract("She can't transfer, she has to stay in her wheelchair")).patch.requirements?.mobility).toBe(
      "must-remain-in-wheelchair",
    );
    expect((await extract("He can transfer to the car seat")).patch.requirements?.mobility).toBe("can-transfer");
  });

  it("extracts companions, names, and phone numbers", async () => {
    const result = await extract("My name is Rose Daniels, my number is 413 555 0142, the passenger is Walter Daniels with one companion");
    expect(result.patch.caregiver).toEqual({ name: "Rose Daniels", phone: "413-555-0142" });
    expect(result.patch.passenger).toEqual({ name: "Walter Daniels" });
    expect(result.patch.requirements?.companionCount).toBe(1);
  });

  it("resolves relative dates in America/New_York and echoes the calendar date", async () => {
    const tomorrow = await extract("The appointment is tomorrow");
    expect(tomorrow.patch.outbound?.tripDate).toBe("2026-10-25");
    expect(tomorrow.note).toBe("Trip date set to Sunday, October 25, 2026.");
    expect((await extract("next Tuesday")).patch.outbound?.tripDate).toBe("2026-10-27");
  });

  it("handles the demo-video sentences exactly as the video script describes", async () => {
    const first = await extract(
      "My dad needs to be at Pine Valley Hospital by 10 a.m. tomorrow. He can't transfer, he stays in his wheelchair, and I'll be coming with him.",
    );
    expect(first.patch.outbound).toMatchObject({ destinationName: "Pine Valley Hospital", requiredArrivalTime: "10:00", tripDate: "2026-10-25" });
    expect(first.patch.requirements).toEqual({ mobility: "must-remain-in-wheelchair", companionCount: 1 });
    expect(first.clarificationNeeded).toBeUndefined();

    const second = await extract("Pick him up from the hospital at 2 p.m.");
    expect(second.patch).toEqual({ return: { pickupTime: "14:00" } });
  });

  it("unrelated speech produces an empty patch and a helpful prompt, never a reset", async () => {
    const result = await extract("hello there");
    expect(result.patch).toEqual({});
    expect(result.clarificationNeeded).toBeTruthy();
  });
});

describe("validateExtractedPatch (Property 17)", () => {
  it("accepts a well-formed patch", () => {
    expect(validateExtractedPatch({ return: { pickupTime: "16:00" } })).toEqual({ return: { pickupTime: "16:00" } });
  });

  it("rejects unknown fields, wrong types, and bad mobility values with no partial pass-through", () => {
    expect(validateExtractedPatch({ booking: { status: "Confirmed" } })).toBeNull();
    expect(validateExtractedPatch({ return: { pickupTime: "16:00", bookingId: "x" } })).toBeNull();
    expect(validateExtractedPatch({ requirements: { companionCount: "two" } })).toBeNull();
    expect(validateExtractedPatch({ requirements: { mobility: "flying" } })).toBeNull();
  });

  it("Property 17: arbitrary objects are either fully allowed or rejected", () => {
    fc.assert(
      fc.property(fc.object(), (raw) => {
        const result = validateExtractedPatch(raw);
        if (result !== null) {
          for (const top of Object.keys(result)) {
            expect(["caregiver", "passenger", "outbound", "return", "requirements"]).toContain(top);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
