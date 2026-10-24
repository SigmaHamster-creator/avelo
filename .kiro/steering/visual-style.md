---
inclusion: fileMatch
fileMatchPattern: 'src/{app,components}/**/*.tsx'
---

# Visual style

Keep the warm, calm, approachable style consistent across every screen and component:

- Palette (see `src/styles/tokens.ts` and `src/app/globals.css`): cream background, white cards, dark green text,
  soft teal primary actions, accessible red for errors. Do not introduce new ad hoc colors outside this palette.
- Large, readable typography; generous spacing; explicit field labels with concise help text; large touch targets
  (minimum 44x44px); visible keyboard focus; strong text contrast; plain English; clear progress indication;
  restrained motion.
- Avoid dense dashboards, unnecessary medical imagery, excessive animation, technical jargon in customer-facing
  copy, and unsupported trust badges or compliance claims.
- Never communicate an error with color alone -- always pair it with an icon and descriptive text.
- Keep copy in plain English and avoid restating the non-emergency disclaimer repeatedly across screens; it is
  stated once on the Landing screen.
