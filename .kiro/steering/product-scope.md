---
inclusion: always
---

# Avelo product scope

Avelo is a **customer-facing-only** MVP for scheduled, non-emergency medical transportation coordination. Keep
every change consistent with this scope:

- Build only the caregiver-facing experience: Landing, Booking Form, Estimate & Review, Booking Status,
  Arrangement Details, and a discreet Demo Controls surface.
- Do **not** build a dispatcher dashboard, a driver application, or a provider management portal.
- Provider availability, matching, and acceptance are **simulated** via deterministic demo scenarios
  (`src/domain/demoScenarios.ts`). Every screen that shows provider or booking information must clearly indicate
  that the matching is simulated (e.g. "Provider matching in this demo is simulated.").
- This is a non-emergency coordination tool. It performs no clinical triage and no emergency dispatch. State the
  non-emergency framing concisely once (e.g. on the Landing screen); do not repeat it so often that it interferes
  with the booking flow.
- No login and no real payment are required or collected anywhere in the app.
- Use fictional demo addresses and deterministic route fixtures, never a real address-verification or live
  routing/traffic service. Never claim an address is "verified" beyond a basic completeness check, and never
  describe a fixture-based time/price as based on live traffic or real-time data.
- Both the outbound and return legs of a booking occur on the same trip date (documented assumption) -- do not add
  a separate return-date field.
- Out of scope entirely: emergency dispatch/clinical triage, live fleet integration, real provider onboarding,
  driver/dispatcher interfaces, real-time vehicle tracking, actual payments/insurance billing, prescription
  pickup/delivery, flexible "call when ready" return pickup, recurring bookings, production healthcare-record
  management, guaranteed transportation availability, and any claim of production security certification or
  regulatory compliance.
