/**
 * Demo hospital directory.
 *
 * Every entry is FICTIONAL demonstration data for the rural Massachusetts
 * demo context. No real address service is used (per the product brief), and
 * these addresses are never presented as verified -- they only let the demo
 * fill in a destination address when a known demo hospital is named.
 *
 * To use real facilities, replace this module with a call to a real places
 * or facility-lookup service behind the same `findHospital` contract.
 */

export interface HospitalEntry {
  name: string;
  address: string;
  /** Other ways a caregiver might say or type the name. */
  aliases: string[];
}

export const HOSPITAL_DIRECTORY: HospitalEntry[] = [
  {
    name: "Pine Valley Hospital",
    address: "40 Valley View Drive, Northampton, MA",
    aliases: ["pine valley", "pine valley medical center"],
  },
  {
    name: "Quabbin Regional Medical Center",
    address: "500 Ridgefield Road, Belchertown, MA",
    aliases: ["quabbin regional", "quabbin medical center", "quabbin regional hospital", "quabbin hospital", "quabbin"],
  },
  {
    name: "Berkshire County Medical Center",
    address: "210 Mountain Pass Road, North Adams, MA",
    aliases: ["berkshire county", "berkshire county hospital", "berkshire medical center"],
  },
  {
    name: "Maple Ridge Medical Center",
    address: "12 Orchard Hill Road, Greenfield, MA",
    aliases: ["maple ridge", "maple ridge hospital"],
  },
  {
    name: "Hilltown Family Clinic",
    address: "7 Meetinghouse Lane, Huntington, MA",
    aliases: ["hilltown clinic", "hilltown family", "hilltown"],
  },
  {
    name: "Deerfield Valley Dialysis Center",
    address: "88 Mill River Road, South Deerfield, MA",
    aliases: ["deerfield valley dialysis", "deerfield dialysis", "deerfield dialysis center"],
  },
  {
    name: "Westfield River Rehabilitation Center",
    address: "300 Riverbend Avenue, Westfield, MA",
    aliases: ["westfield river rehab", "westfield rehab", "westfield river rehabilitation", "westfield rehabilitation center"],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(?:the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exact (normalized) match of a hospital name or alias, e.g. "pine valley hospital" or "Pine Valley". */
export function findHospital(name: string): HospitalEntry | null {
  const target = normalize(name);
  if (!target) return null;
  return HOSPITAL_DIRECTORY.find((h) => normalize(h.name) === target || h.aliases.some((a) => normalize(a) === target)) ?? null;
}

export interface HospitalMention {
  hospital: HospitalEntry;
  /** Character index of the mention in the searched (lowercase) text. */
  index: number;
}

/**
 * Finds the LAST directory hospital mentioned anywhere in free text (latest
 * mention wins), preferring the longest matching name at each position.
 */
export function findHospitalMention(lowerText: string): HospitalMention | null {
  let best: HospitalMention | null = null;
  let bestLength = 0;
  for (const hospital of HOSPITAL_DIRECTORY) {
    for (const phrase of [hospital.name.toLowerCase(), ...hospital.aliases]) {
      const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(lowerText)) !== null) {
        const later = !best || match.index > best.index;
        const sameSpotLonger = best && match.index === best.index && phrase.length > bestLength;
        if (later || sameSpotLonger) {
          best = { hospital, index: match.index };
          bestLength = phrase.length;
        }
      }
    }
  }
  return best;
}
