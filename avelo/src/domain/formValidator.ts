/**
 * FormValidator (Task 1.4): the single shared validation ruleset applied
 * identically to manual edits and voice-populated patches. Returns the
 * exact list of currently-invalid fields for a (partial or full) form.
 */
import type { BookingFormData, ValidationError } from "./types";

const PHONE_PATTERN = /^[0-9()+\-.\s]{7,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function timeToMinutes(hhmm: string): number | null {
  const match = TIME_PATTERN.exec(hhmm);
  if (!match) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function todayInEasternISO(): string {
  // America/New_York, documented per the voice/date-resolution requirements.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

export function validateForm(form: BookingFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!form.caregiver.name.trim()) {
    errors.push({ field: "caregiver.name", message: "Enter the caregiver's name.", code: "REQUIRED" });
  }
  if (!form.caregiver.phone.trim()) {
    errors.push({ field: "caregiver.phone", message: "Enter a phone number so the provider can reach you.", code: "REQUIRED" });
  } else if (!PHONE_PATTERN.test(form.caregiver.phone.trim())) {
    errors.push({ field: "caregiver.phone", message: "Enter a valid phone number.", code: "INVALID_FORMAT" });
  }

  if (!form.passenger.name.trim()) {
    errors.push({ field: "passenger.name", message: "Enter the passenger's name.", code: "REQUIRED" });
  }

  if (!form.outbound.pickupAddress.trim()) {
    errors.push({ field: "outbound.pickupAddress", message: "Enter the pickup address.", code: "REQUIRED" });
  }
  if (!form.outbound.destinationName.trim()) {
    errors.push({ field: "outbound.destinationName", message: "Enter the destination or hospital name.", code: "REQUIRED" });
  }
  if (!form.outbound.destinationAddress.trim()) {
    errors.push({ field: "outbound.destinationAddress", message: "Enter the destination address.", code: "REQUIRED" });
  }

  let tripDateValid = false;
  if (!form.outbound.tripDate.trim()) {
    errors.push({ field: "outbound.tripDate", message: "Enter the trip date.", code: "REQUIRED" });
  } else if (!DATE_PATTERN.test(form.outbound.tripDate)) {
    errors.push({ field: "outbound.tripDate", message: "Enter a valid date.", code: "INVALID_FORMAT" });
  } else if (form.outbound.tripDate < todayInEasternISO()) {
    errors.push({ field: "outbound.tripDate", message: "Choose a trip date today or in the future.", code: "NOT_FUTURE" });
  } else {
    tripDateValid = true;
  }

  let requiredArrivalMinutes: number | null = null;
  if (!form.outbound.requiredArrivalTime.trim()) {
    errors.push({ field: "outbound.requiredArrivalTime", message: "Enter the required arrival time.", code: "REQUIRED" });
  } else {
    requiredArrivalMinutes = timeToMinutes(form.outbound.requiredArrivalTime);
    if (requiredArrivalMinutes === null) {
      errors.push({ field: "outbound.requiredArrivalTime", message: "Enter a valid arrival time.", code: "INVALID_FORMAT" });
    } else if (tripDateValid && form.outbound.tripDate === todayInEasternISO()) {
      const now = new Date();
      const nowEastern = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      const [nh, nm] = nowEastern.split(":").map(Number);
      if (requiredArrivalMinutes <= nh * 60 + nm) {
        errors.push({ field: "outbound.requiredArrivalTime", message: "Choose an arrival time later than now.", code: "NOT_FUTURE" });
      }
    }
  }

  let returnMinutes: number | null = null;
  if (!form.return.pickupTime.trim()) {
    errors.push({ field: "return.pickupTime", message: "Enter the return pickup time.", code: "REQUIRED" });
  } else {
    returnMinutes = timeToMinutes(form.return.pickupTime);
    if (returnMinutes === null) {
      errors.push({ field: "return.pickupTime", message: "Enter a valid return pickup time.", code: "INVALID_FORMAT" });
    } else if (requiredArrivalMinutes !== null && returnMinutes <= requiredArrivalMinutes) {
      errors.push({
        field: "return.pickupTime",
        message: "The return pickup time must be later than the required arrival time.",
        code: "NOT_AFTER_ARRIVAL",
      });
    }
  }

  if (form.return.originAddress.trim() === "") {
    // Allowed: will default to outbound.destinationAddress. Not an error.
  }
  if (form.return.destinationAddress.trim() === "") {
    // Allowed: will default to outbound.pickupAddress. Not an error.
  }

  if (!form.requirements.mobility) {
    errors.push({ field: "requirements.mobility", message: "Select whether the passenger can transfer or must remain in their wheelchair.", code: "REQUIRED" });
  }

  if (
    !Number.isInteger(form.requirements.companionCount) ||
    form.requirements.companionCount < 0 ||
    form.requirements.companionCount > 4
  ) {
    errors.push({
      field: "requirements.companionCount",
      message: "Enter a number of companions between 0 and 4.",
      code: "OUT_OF_RANGE",
    });
  }

  if (form.requirements.specialRequests.length > 500) {
    errors.push({
      field: "requirements.specialRequests",
      message: "Keep special requests under 500 characters.",
      code: "TOO_LONG",
    });
  }

  return errors;
}

export function isFormValid(form: BookingFormData): boolean {
  return validateForm(form).length === 0;
}
