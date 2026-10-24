"use client";

import { forwardRef } from "react";
import type { ValidationError } from "@/domain/types";

/**
 * ValidationErrorSummary (Task 1.13): an accessible, focusable list of
 * current validation errors. The Booking Form page moves keyboard focus
 * here (or to the first invalid field) on a blocked submit attempt
 * (AC-VALIDATION-01).
 */
export const ValidationErrorSummary = forwardRef<HTMLDivElement, { errors: ValidationError[] }>(function ValidationErrorSummary(
  { errors },
  ref,
) {
  if (errors.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      style={{
        border: "2px solid var(--color-error)",
        background: "var(--color-error-bg)",
        borderRadius: "10px",
        padding: "var(--space-md)",
        marginBottom: "var(--space-lg)",
      }}
    >
      <p style={{ fontWeight: 700, color: "var(--color-error)", marginBottom: "8px" }}>
        Please fix the following before continuing:
      </p>
      <ul style={{ paddingLeft: "20px" }}>
        {errors.map((error) => (
          <li key={error.field} style={{ color: "var(--color-error)" }}>
            {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
});
