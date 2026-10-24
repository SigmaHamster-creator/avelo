---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts'
---

# Testing principles

- Test externally observable behavior (the caregiver journey; the merge/validation/pricing/state-machine
  contracts), not component implementation details.
- Prefer a small number of high-level test boundaries over exhaustively testing every internal function.
- Use property-based tests (fast-check) for rules with a clear universal quantification: the merge contract
  (mentions govern change, omission preserves, explicit clear removes, latest wins, stale responses never
  regress), pricing determinism/additivity, the suggested-pickup-time formula, state-machine transition legality,
  and matching's hard-requirement guards.
- Never claim a test passed without actually running it. Document the exact command and the actual result (pass
  count, file count) in README.md and KIRO_USAGE.md.
- End-to-end tests should cover the complete caregiver journey (standard booking, special-request/price-approval,
  replacement, repeat-after-reset), driven through the real UI and real API routes against simulated/fixture
  domain data -- not through direct unit calls.
