"use client";

import type { ReactNode } from "react";

interface FieldProps {
  id: string;
  label: string;
  helpText?: string;
  error?: string;
  children: ReactNode;
}

/**
 * Shared field wrapper (Tasks 1.12, 7.9): clear label, optional help text,
 * and an error rendered with an icon AND text (never color alone), with a
 * red border applied by the caller on the input element itself.
 */
export function Field({ id, label, helpText, error, children }: FieldProps) {
  return (
    <div style={{ marginBottom: "var(--space-lg)" }}>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
        {label}
      </label>
      {helpText && (
        <p id={`${id}-help`} style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", opacity: 0.8, marginBottom: "6px" }}>
          {helpText}
        </p>
      )}
      {children}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{
            color: "var(--color-error)",
            fontSize: "var(--text-sm)",
            marginTop: "6px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

export function fieldInputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: "var(--min-touch-target)",
    padding: "10px 12px",
    fontSize: "var(--text-base)",
    borderRadius: "8px",
    border: `2px solid ${hasError ? "var(--color-error)" : "var(--color-border)"}`,
    background: hasError ? "var(--color-error-bg)" : "var(--color-card)",
    color: "var(--color-text)",
  };
}
