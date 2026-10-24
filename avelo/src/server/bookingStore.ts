/**
 * BookingStore (Tasks 1.3, 3.6, 7.3, 7.4): minimal, explicitly non-production
 * persistence for booking + scenario state.
 *
 * IMPLEMENTATION NOTE (documented deviation from the original per-session
 * draft-store sketch in design.md): the booking FORM DRAFT lives in the
 * browser (React state) rather than in a server-side session store. The
 * shared FormValidator and FieldMergeEngine modules are plain, isomorphic
 * TypeScript with no server-only dependencies, so they run identically on
 * the client (for instant manual-edit feedback and for applying voice
 * patches) and would run the same way here if ever needed server-side.
 * This keeps the app simpler (no session cookies, no server-side draft
 * sync) while leaving every merge/validation/versioning RULE identical to
 * what is documented in design.md -- only the storage location of the
 * pre-submission draft changes. Booking-request `clientRequestId` dedupe
 * keeps the double-submission guard working without any session concept.
 *
 * Everything in this module is a single process-wide, in-memory store. It
 * is NOT a production database: no durability across restarts, no
 * authentication, single process only. Using `globalThis` to survive the
 * Next.js dev server's module-reload-on-save behavior.
 */
import type { Booking, BookingEvent, BookingFormData, BookingStatus, EstimateResult, DemoScenarioId } from "@/domain/types";
import { transition } from "@/domain/bookingStateMachine";

interface StoreShape {
  bookings: Map<string, Booking>;
  timers: Map<string, ReturnType<typeof setTimeout>[]>;
  requestDedupe: Map<string, string>; // clientRequestId -> bookingId
}

function getStore(): StoreShape {
  const g = globalThis as unknown as { __aveloStore?: StoreShape };
  if (!g.__aveloStore) {
    g.__aveloStore = {
      bookings: new Map(),
      timers: new Map(),
      requestDedupe: new Map(),
    };
  }
  return g.__aveloStore;
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function hasClientRequestId(clientRequestId: string): boolean {
  return getStore().requestDedupe.has(clientRequestId);
}

export function createBooking(
  form: BookingFormData,
  estimate: EstimateResult,
  scenarioId: DemoScenarioId,
  clientRequestId?: string,
): Booking {
  const store = getStore();

  const bookingId = generateId("AVL");
  const booking: Booking = {
    bookingId,
    demoSessionId: bookingId,
    epoch: 0,
    status: "RequestSubmitted",
    form,
    originalEstimate: estimate,
    history: [{ status: "RequestSubmitted", at: new Date().toISOString() }],
    scenarioId,
  };
  store.bookings.set(bookingId, booking);
  if (clientRequestId) store.requestDedupe.set(clientRequestId, bookingId);
  return booking;
}

export function getBooking(bookingId: string): Booking | undefined {
  return getStore().bookings.get(bookingId);
}

export function applyEvent(bookingId: string, event: BookingEvent, mutate?: (b: Booking) => Booking): Booking | null {
  const store = getStore();
  const booking = store.bookings.get(bookingId);
  if (!booking) return null;

  const result = transition(booking.status, event);
  if (!result.ok) return null;

  let next: Booking = {
    ...booking,
    status: result.nextStatus,
    history: [...booking.history, { status: result.nextStatus, at: new Date().toISOString() }],
  };
  if (mutate) next = mutate(next);

  store.bookings.set(bookingId, next);
  return next;
}

export function forceStatus(bookingId: string, status: BookingStatus, mutate?: (b: Booking) => Booking): Booking | null {
  const store = getStore();
  const booking = store.bookings.get(bookingId);
  if (!booking) return null;
  let next: Booking = { ...booking, status, history: [...booking.history, { status, at: new Date().toISOString() }] };
  if (mutate) next = mutate(next);
  store.bookings.set(bookingId, next);
  return next;
}

/** Schedules a timer tied to a bookingId so it can be cancelled on reset / supersession. */
export function scheduleTimer(bookingId: string, fn: () => void, delayMs: number): void {
  const store = getStore();
  const handle = setTimeout(() => {
    // Guard: if the booking no longer exists (e.g. reset), silently drop.
    if (!store.bookings.has(bookingId)) return;
    fn();
  }, delayMs);
  const list = store.timers.get(bookingId) ?? [];
  list.push(handle);
  store.timers.set(bookingId, list);
}

export function clearTimers(bookingId: string): void {
  const store = getStore();
  const list = store.timers.get(bookingId);
  if (list) {
    for (const handle of list) clearTimeout(handle);
    store.timers.delete(bookingId);
  }
}

/** Full teardown of a booking and any pending timers (used by demo reset). */
export function deleteBooking(bookingId: string): void {
  clearTimers(bookingId);
  getStore().bookings.delete(bookingId);
}
