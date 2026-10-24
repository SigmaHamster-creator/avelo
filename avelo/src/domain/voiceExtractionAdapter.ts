/**
 * VoiceExtractionAdapter (Tasks 4.4, 4.6, 4.8, 4.10): turns an English
 * transcript plus the current form snapshot into a FormFieldPatch.
 *
 * Two implementations satisfy the same interface:
 *  - `DeterministicFallbackExtractor` (default): a documented, auditable
 *    set of pattern-matching rules. Makes ZERO network calls. This is NOT an
 *    AI model and must never be represented as one -- every response it
 *    produces is tagged `source: 'deterministic-fallback'`.
 *  - A real LLM-backed implementation can be plugged in later by
 *    implementing `VoiceExtractionAdapter` and selecting it in
 *    `getActiveExtractor()` based on `process.env.AI_EXTRACTION_PROVIDER`.
 *    This module only ever runs server-side (inside a Next.js API route).
 *
 * Rules implemented by the fallback (see .kiro/steering/voice-merge-semantics.md):
 *  - Only fields the utterance mentions appear in the patch.
 *  - Browser speech output is normalized first ("4 p.m." -> "4 pm").
 *  - Each spoken time is assigned to a trip leg from nearby wording:
 *    "arrive / be there by / appointment is at / get her to" -> required
 *    arrival time (outbound); "coming home / ride home / bring her back /
 *    after the appointment" -> return pickup time. "Pick her up FROM <the
 *    hospital>" is the ride home, so it sets the return pickup time.
 *  - If a time's leg cannot be determined, that time is not applied and a
 *    focused clarification question is returned instead.
 *  - Explicit uncertainty ("three or four, I'm not sure") never becomes a
 *    definite time.
 *  - A self-correction ("3 PM, actually 4 PM") keeps the final value.
 *  - A generic "the hospital" never invents a hospital name; no address is
 *    ever invented for "home".
 *  - Relative dates resolve against nowISO in America/New_York, and the
 *    resolved calendar date is echoed back in `note`.
 */
import { findHospital, findHospitalMention } from "./hospitalDirectory";
import { formatHHMMTo12Hour } from "./pickupTimeCalculator";
import type { BookingFormData, FormFieldPatch, Mobility, TripLeg, VoiceExtractResult } from "./types";
import { isClearMarker } from "./types";

export interface ExtractInput {
  transcript: string;
  currentFormSnapshot: BookingFormData;
  nowISO: string;
}

export interface VoiceExtractionAdapter {
  extract(input: ExtractInput): Promise<VoiceExtractResult>;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const HOUR_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const COUNT_WORDS: Record<string, number> = { no: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const HOUR = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const COUNT = "(\\d|no|zero|one|two|three|four|five|six)";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toNumber(token: string, words: Record<string, number>): number | null {
  const lower = token.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return lower in words ? words[lower] : null;
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i > 0 && ["of", "the", "and"].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalizes browser speech output so patterns match reliably. */
export function normalizeTranscript(raw: string): string {
  return raw
    .replace(/(^|[\s\d])([ap])\.\s?m\b\.?/gi, (_m, pre: string, letter: string) => `${pre}${letter.toLowerCase()}m`)
    .replace(/\bnoon\b/gi, "12 pm")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Times and trip legs
// ---------------------------------------------------------------------------

interface TimeMention {
  value: string; // HH:mm
  index: number;
  end: number;
}

function findTimes(lower: string): TimeMention[] {
  const re = new RegExp(`\\b${HOUR}(?::([0-5]\\d))?\\s*(am|pm)\\b`, "g");
  const out: TimeMention[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(lower)) !== null) {
    let hour = toNumber(match[1], HOUR_WORDS);
    if (hour === null || hour < 1 || hour > 12) continue;
    const minute = match[2] ? Number(match[2]) : 0;
    const isPm = match[3] === "pm";
    if (isPm && hour !== 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    out.push({ value: `${pad(hour)}:${pad(minute)}`, index: match.index, end: match.index + match[0].length });
  }
  return out;
}

const UNCERTAINTY_PHRASES = [
  "not sure", "unsure", "maybe", "i think", "i guess", "probably", "or so", "something like", "don't know", "do not know", "not certain",
];
/** "three or four", "3 or 4 pm" -- but not "one or two companions". */
const ALTERNATIVE_TIMES = new RegExp(
  `\\b${HOUR}(?::[0-5]\\d)?\\s*(?:am|pm)?\\s+or\\s+${HOUR}(?::[0-5]\\d)?\\b(?!\\s*(?:companions?|people|persons?|riders?|minutes?|mins?|hours?|days?|weeks?))`,
);

function isTimeUncertain(lower: string, times: TimeMention[]): boolean {
  if (ALTERNATIVE_TIMES.test(lower)) return true;
  return times.some((t) => {
    const window = lower.slice(Math.max(0, t.index - 40), Math.min(lower.length, t.end + 40));
    return UNCERTAINTY_PHRASES.some((phrase) => window.includes(phrase));
  });
}

const RETURN_CUES = [
  "coming home", "come home", "comes home", "go home", "going home", "get home", "back home", "coming back", "come back",
  "bring her back", "bring him back", "bring them back", "take her home", "take him home", "drive her home", "drive him home",
  "ride home", "trip home", "way back", "trip back", "ride back", "return", "after the appointment", "after her appointment",
  "after his appointment", "when she's done", "when he's done", "when she is done", "when he is done", "once she's done",
  "once he's done", "when it's over", "once it's over",
];
const OUTBOUND_CUES = [
  "arrive", "arrival", "be there", "get there", "appointment is", "appointment starts", "appointment at", "needs to be at",
  "has to be at", "need to be at", "get her to", "get him to", "take her to", "take him to", "drive her to", "drive him to",
  "bring her to", "bring him to", "drop her off", "drop him off", "drop off", "check in", "check-in",
];
const RETURN_CUE_RE = new RegExp(RETURN_CUES.map(escapeRegExp).join("|"), "g");
const CORRECTION_MARKERS = [
  "actually", "no wait", "wait", "i mean", "sorry", "make that", "make it", "instead", "rather", "change that", "change it",
  "correction", "scratch that",
];

/** Returns a leg only when the segment's wording points unambiguously to one. */
function cueLeg(segment: string): TripLeg | null {
  const hasReturn = RETURN_CUES.some((cue) => segment.includes(cue));
  // Strip return phrases first so "after the appointment at 2 pm" isn't read as an arrival.
  const withoutReturn = segment.replace(RETURN_CUE_RE, " ");
  const hasOutbound =
    OUTBOUND_CUES.some((cue) => withoutReturn.includes(cue)) || /\bby\s*$/.test(withoutReturn) || /\bby\s+\d/.test(withoutReturn);
  if (hasReturn && !hasOutbound) return "return";
  if (hasOutbound && !hasReturn) return "outbound";
  return null;
}

function resolveTimeLegs(lower: string, times: TimeMention[], lastPlace: PlaceMention | null): (TripLeg | null)[] {
  const legs: (TripLeg | null)[] = [];
  times.forEach((time, i) => {
    const lead = lower.slice(i === 0 ? 0 : times[i - 1].end, time.index);
    const trailing = lower.slice(time.end, i === times.length - 1 ? lower.length : times[i + 1].index);
    let leg = cueLeg(lead) ?? cueLeg(trailing);

    if (!leg && i > 0 && legs[i - 1] && CORRECTION_MARKERS.some((m) => lead.includes(m))) {
      leg = legs[i - 1]; // "3 pm, actually make that 4 pm" keeps the same leg
    }
    if (!leg && /\bpick(?:ing|ed)?\b[^.]*\bup\b|\bpickup\b/.test(lead) && legs.some((l) => l === "outbound")) {
      leg = "return"; // "get her there by 9 am and pick her up at 1 pm"
    }
    if (!leg && times.length === 1) {
      leg = cueLeg(lower) ?? (lastPlace ? placeLeg(lastPlace, lower) : null);
    }
    legs.push(leg);
  });
  return legs;
}

// ---------------------------------------------------------------------------
// Places (hospital / clinic names)
// ---------------------------------------------------------------------------

interface PlaceMention {
  name: string | null; // null when generic ("the hospital") -- never invented
  preposition: "from" | "to" | "at";
  index: number;
}

const PLACE_KEYWORDS =
  "(?:hospital|clinic|medical center|medical centre|health center|health centre|medical building|cancer center|dialysis center|surgery center|rehab center|rehabilitation center)";
const PLACE_RE = new RegExp(
  `\\b(from|to|at)\\s+((?:(?!(?:from|to|at|by|and|for|on|in|with|am|pm)\\b)[a-z0-9'.&-]+\\s+){0,5}?${PLACE_KEYWORDS})\\b`,
  "g",
);
const GENERIC_PLACE = new RegExp(`^${PLACE_KEYWORDS}$`);

function findPlaces(lower: string): PlaceMention[] {
  const out: PlaceMention[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(PLACE_RE.source, "g");
  while ((match = re.exec(lower)) !== null) {
    const words = match[2].trim().split(/\s+/);
    while (words.length > 0 && ["the", "my", "her", "his", "their", "our", "a", "an"].includes(words[0])) words.shift();
    const core = words.join(" ");
    out.push({
      name: GENERIC_PLACE.test(core) ? null : titleCase(core),
      preposition: match[1] as PlaceMention["preposition"],
      index: match.index,
    });
  }
  return out;
}

/** "Pick her up FROM the hospital" is the ride home; "TO the hospital" is the outbound trip. */
function placeLeg(place: PlaceMention, lower: string): TripLeg {
  if (place.preposition === "from") return "return";
  if (place.preposition === "to") return "outbound";
  return /\bpick/.test(lower.slice(0, place.index)) ? "return" : "outbound";
}

// ---------------------------------------------------------------------------
// Street addresses
// ---------------------------------------------------------------------------

type AddressField = "outbound.pickupAddress" | "outbound.destinationAddress" | "return.originAddress" | "return.destinationAddress";

const STREET_SUFFIX =
  "(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|way|court|ct|boulevard|blvd|place|pl|circle|cir|terrace|highway|hwy|parkway|pkwy|trail|path|square|sq)";
const ADDRESS_STOP = "(?:from|to|at|by|and|in|on|for|am|pm|she|he|her|his|they)";
const ADDRESS_RE = new RegExp(
  `\\b(\\d{1,5}\\s+(?:(?!${ADDRESS_STOP}\\b)[a-z0-9'.-]+\\s+){0,4}?${STREET_SUFFIX})\\b\\.?` +
    `(?:(?:,\\s*|\\s+in\\s+)((?!${ADDRESS_STOP}\\b|ma\\b|massachusetts\\b)[a-z][a-z'-]+(?:\\s+(?!${ADDRESS_STOP}\\b|ma\\b|massachusetts\\b)[a-z][a-z'-]+)?))?` +
    `(?:,?\\s+(ma|massachusetts)\\b)?`,
  "g",
);
const DEST_RE = /\b(?:hospital|clinic|center|centre|destination|appointment|office|doctor'?s?)\b/g;
const PICKUP_RE = /\b(?:pick|picked|pickup|lives?|living|home|house|stays?|staying|apartment)\b/g;

function lastIndex(text: string, re: RegExp): number {
  const global = new RegExp(re.source, "g");
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) last = match.index;
  return last;
}

function resolveAddressField(lower: string, index: number): AddressField | null {
  const lead = lower.slice(Math.max(0, index - 60), index);
  const returnAt = lastIndex(lead, RETURN_CUE_RE);
  const blanked = lead.replace(RETURN_CUE_RE, (m) => " ".repeat(m.length));
  const destAt = lastIndex(blanked, DEST_RE);
  const pickupAt = lastIndex(blanked, PICKUP_RE);

  if (returnAt >= 0 && returnAt >= destAt && returnAt >= pickupAt) {
    return /\bfrom\b/.test(lead.slice(returnAt)) ? "return.originAddress" : "return.destinationAddress";
  }
  if (destAt >= 0 && destAt >= pickupAt) return "outbound.destinationAddress";
  if (pickupAt >= 0) return "outbound.pickupAddress";
  if (/\bfrom\s*$/.test(lead)) return "outbound.pickupAddress";
  if (/\bto\s*(?:the\s*)?$/.test(lead)) return "outbound.destinationAddress";
  return null;
}

// ---------------------------------------------------------------------------
// Dates (America/New_York)
// ---------------------------------------------------------------------------

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function easternToday(nowISO: string): { y: number; m: number; d: number; weekday: number } {
  const parsed = new Date(nowISO);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), weekday: WEEKDAYS.indexOf(get("weekday").toLowerCase()) };
}

function isoFromParts(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function resolveDate(lower: string, nowISO: string): string | null {
  const today = easternToday(nowISO);
  const plusDays = (days: number) => isoFromParts(today.y, today.m, today.d + days);

  if (/\bday after tomorrow\b/.test(lower)) return plusDays(2);
  if (/\btomorrow\b/.test(lower)) return plusDays(1);
  if (/\btoday\b/.test(lower)) return plusDays(0);

  const weekday = /\b(?:next|this|on|coming)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(lower);
  if (weekday) {
    let diff = (WEEKDAYS.indexOf(weekday[1]) - today.weekday + 7) % 7;
    if (diff === 0) diff = 7;
    return plusDays(diff);
  }

  const monthDay = new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(lower);
  if (monthDay) {
    const month = MONTHS.indexOf(monthDay[1]) + 1;
    const day = Number(monthDay[2]);
    if (day < 1 || day > 31) return null;
    let iso = isoFromParts(today.y, month, day);
    if (iso < isoFromParts(today.y, today.m, today.d)) iso = isoFromParts(today.y + 1, month, day);
    return iso;
  }
  return null;
}

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

// ---------------------------------------------------------------------------
// People, phone, mobility, companions, special requests
// ---------------------------------------------------------------------------

const NAME_STOP = new Set([
  "and", "but", "she", "he", "her", "his", "i", "my", "we", "the", "from", "to", "at", "is", "so", "phone", "number", "needs",
  "will", "has", "lives", "can", "uses", "with", "on",
]);

function captureName(lower: string, re: RegExp): string | null {
  const match = re.exec(lower);
  if (!match) return null;
  const kept: string[] = [];
  for (const word of match[1].split(/\s+/)) {
    if (NAME_STOP.has(word) || kept.length === 3) break;
    kept.push(word);
  }
  return kept.length > 0 ? titleCase(kept.join(" ")) : null;
}

function detectMobility(lower: string): Mobility | null {
  if (
    /\b(?:can'?t|cannot|can not|unable to|doesn'?t|does not|won'?t be able to)\s+(?:\w+\s+)?transfer/.test(lower) ||
    /\b(?:stay|stays|staying|remain|remains|remaining)\s+(?:seated\s+)?in\s+(?:her|his|their|the|a)\s+wheelchair/.test(lower) ||
    /\bwheelchair.{0,25}\b(?:stay|remain)/.test(lower)
  ) {
    return "must-remain-in-wheelchair";
  }
  if (/\b(?:can|able to|is able to)\s+(?:\w+\s+)?transfer/.test(lower) || /\btransfers?\s+(?:to|into)\s+(?:a|the)\s+(?:car\s+|vehicle\s+)?seat/.test(lower)) {
    return "can-transfer";
  }
  return null;
}

function detectCompanions(lower: string): number | null {
  const counted = new RegExp(
    `\\b${COUNT}\\s+(?:companions?|other (?:people|riders?|passengers?)|extra (?:people|riders?|passengers?))\\b`,
  ).exec(lower);
  if (counted) return toNumber(counted[1], COUNT_WORDS);
  if (/\b(?:i'll|i will|i am|i'm)\s+(?:be\s+)?(?:coming|riding|going)\s+(?:along\s+)?with\b/.test(lower)) return 1;
  return null;
}

function detectSpecialRequest(text: string): string | null {
  const match = /\b(?:special requests?(?:\s+(?:is|are))?|additional assistance(?:\s+(?:is|with))?|(?:she|he|they) needs? (?:extra )?help|needs? (?:extra )?help)\b[:\s]*(.+?)(?=[,.!?;]|\s+and\s+(?:she|he|they|needs?|arrive|pick|her|his|the)\b|$)/i.exec(
    text,
  );
  if (!match) return null;
  const sentence = match[0].replace(/^special requests?\s*(?:is|are)?\s*:?\s*/i, "").trim();
  if (sentence.length < 4) return null;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ---------------------------------------------------------------------------
// The deterministic fallback extractor
// ---------------------------------------------------------------------------

export class DeterministicFallbackExtractor implements VoiceExtractionAdapter {
  async extract(input: ExtractInput): Promise<VoiceExtractResult> {
    const text = normalizeTranscript(input.transcript);
    const lower = text.toLowerCase();
    const patch: FormFieldPatch = {};
    const questions: string[] = [];
    const notes: string[] = [];
    let resolvedLeg: TripLeg | undefined;

    // Hospital / clinic name (only when actually named). Directory hospitals
    // are recognized even without a keyword ("take her to Pine Valley") and
    // use their canonical name; the matching address is filled in by the
    // form's shared hospital-directory rule, not here.
    const places = findPlaces(lower);
    let lastPlace = places.length > 0 ? places[places.length - 1] : null;
    const mention = findHospitalMention(lower);
    if (mention && (!lastPlace || mention.index > lastPlace.index)) {
      const before = /\b(from|to|at)\s+(?:the\s+)?$/.exec(lower.slice(Math.max(0, mention.index - 12), mention.index));
      lastPlace = {
        name: mention.hospital.name,
        preposition: (before?.[1] as PlaceMention["preposition"] | undefined) ?? "at",
        index: mention.index,
      };
    }
    if (lastPlace?.name) {
      const destinationName = findHospital(lastPlace.name)?.name ?? lastPlace.name;
      patch.outbound = { ...patch.outbound, destinationName };
    }

    // Times, each assigned to a trip leg.
    const times = findTimes(lower);
    if (isTimeUncertain(lower, times)) {
      questions.push("What exact time should I use? It sounded like you weren't sure, so I didn't change any times.");
    } else if (times.length > 0) {
      const legs = resolveTimeLegs(lower, times, lastPlace);
      let outboundTime: string | null = null;
      let returnTime: string | null = null;
      let unresolved: string | null = null;
      times.forEach((t, i) => {
        if (legs[i] === "outbound") outboundTime = t.value; // later values win (self-correction)
        else if (legs[i] === "return") returnTime = t.value;
        else unresolved = t.value;
      });
      if (outboundTime) patch.outbound = { ...patch.outbound, requiredArrivalTime: outboundTime };
      if (returnTime) patch.return = { ...patch.return, pickupTime: returnTime };
      if (unresolved) {
        questions.push(
          `Is ${formatHHMMTo12Hour(unresolved)} the time the passenger needs to arrive at the appointment, or the pickup time for the ride home?`,
        );
      }
      if (outboundTime && !returnTime) resolvedLeg = "outbound";
      if (returnTime && !outboundTime) resolvedLeg = "return";
    }

    // Street addresses.
    const addressRe = new RegExp(ADDRESS_RE.source, "g");
    let addressMatch: RegExpExecArray | null;
    while ((addressMatch = addressRe.exec(lower)) !== null) {
      const street = titleCase(addressMatch[1]);
      const town = addressMatch[2] ? titleCase(addressMatch[2]) : null;
      const state = addressMatch[3] ? "MA" : null;
      const address = [street, town, state].filter(Boolean).join(", ");
      const field = resolveAddressField(lower, addressMatch.index);
      if (!field) {
        questions.push(`Is ${address} the pickup address or the destination address?`);
        continue;
      }
      const [top, sub] = field.split(".") as ["outbound" | "return", string];
      patch[top] = { ...(patch[top] as Record<string, string> | undefined), [sub]: address };
    }

    // People and contact details.
    const caregiverName = captureName(lower, /\bmy name is\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})/);
    if (caregiverName) patch.caregiver = { ...patch.caregiver, name: caregiverName };
    const passengerName = captureName(
      lower,
      /\b(?:(?:the\s+)?passenger(?:'s)?(?:\s+name)?\s+is|(?:her|his|their)\s+name\s+is|(?:the\s+)?ride\s+is\s+for)\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3})/,
    );
    if (passengerName) patch.passenger = { name: passengerName };
    const phone = /(?:\+?1[\s.-]*)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})\b/.exec(lower);
    if (phone) patch.caregiver = { ...patch.caregiver, phone: `${phone[1]}-${phone[2]}-${phone[3]}` };

    // Transportation requirements.
    const mobility = detectMobility(lower);
    if (mobility) patch.requirements = { ...patch.requirements, mobility };
    const companions = detectCompanions(lower);
    if (companions !== null) patch.requirements = { ...patch.requirements, companionCount: companions };
    const special = detectSpecialRequest(text);
    if (special) patch.requirements = { ...patch.requirements, specialRequests: special };

    // Trip date.
    const date = resolveDate(lower, input.nowISO);
    if (date) {
      patch.outbound = { ...patch.outbound, tripDate: date };
      notes.push(`Trip date set to ${formatLongDate(date)}.`);
    }

    const empty = Object.keys(patch).length === 0;
    if (empty && questions.length === 0) {
      questions.push(
        "I couldn't find trip details in that. Try mentioning a time, the hospital, an address, or whether the passenger uses a wheelchair.",
      );
    }

    return {
      patch,
      resolvedLeg,
      clarificationNeeded: questions.length > 0 ? questions.join(" ") : undefined,
      note: notes.length > 0 ? notes.join(" ") : undefined,
      resolvedRelativeDate: date ?? undefined,
      confidence: empty ? 0.1 : questions.length > 0 ? 0.5 : 0.8,
      source: "deterministic-fallback",
    };
  }
}

// ---------------------------------------------------------------------------
// Server-side validation of extractor output (Requirement 95 / Property 17)
// ---------------------------------------------------------------------------

type FieldKind = "string" | "number" | "mobility";
const ALLOWED_PATCH_FIELDS: Record<string, Record<string, FieldKind>> = {
  caregiver: { name: "string", phone: "string" },
  passenger: { name: "string" },
  outbound: {
    pickupAddress: "string",
    destinationName: "string",
    destinationAddress: "string",
    tripDate: "string",
    requiredArrivalTime: "string",
  },
  return: { pickupTime: "string", originAddress: "string", destinationAddress: "string" },
  requirements: { mobility: "mobility", companionCount: "number", specialRequests: "string" },
};

/**
 * Returns the patch if every key and value is allowed, otherwise null.
 * Never passes a partially-valid patch through, so an extractor (real or
 * fallback) can never change arbitrary application state.
 */
export function validateExtractedPatch(raw: unknown): FormFieldPatch | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  for (const [top, sub] of Object.entries(raw as Record<string, unknown>)) {
    const allowed = ALLOWED_PATCH_FIELDS[top];
    if (!allowed || typeof sub !== "object" || sub === null || Array.isArray(sub)) return null;
    for (const [key, value] of Object.entries(sub as Record<string, unknown>)) {
      const kind = allowed[key];
      if (!kind) return null;
      if (isClearMarker(value)) continue;
      if (kind === "string" && (typeof value !== "string" || value.length > 500)) return null;
      if (kind === "number" && (typeof value !== "number" || !Number.isFinite(value))) return null;
      if (kind === "mobility" && value !== "can-transfer" && value !== "must-remain-in-wheelchair") return null;
    }
  }
  return raw as FormFieldPatch;
}

let cachedAdapter: VoiceExtractionAdapter | null = null;

/**
 * Selects the active extractor. Defaults to the deterministic fallback
 * when AI_EXTRACTION_PROVIDER is unset. A real provider would be wired in
 * here, reading its API key only from server-side environment variables
 * (never shipped to the client). See README "Enabling a real voice/AI
 * extraction provider".
 */
export function getActiveExtractor(): { adapter: VoiceExtractionAdapter; source: "deterministic-fallback" | "llm" } {
  // No real-provider adapter is implemented in this MVP, so any value of
  // AI_EXTRACTION_PROVIDER still falls back safely rather than crashing.
  if (!cachedAdapter) cachedAdapter = new DeterministicFallbackExtractor();
  return { adapter: cachedAdapter, source: "deterministic-fallback" };
}
