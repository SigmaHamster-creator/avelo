"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger-text";
  loading?: boolean;
}

/** Shared button: soft-teal primary action, large touch target, visible loading state. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, disabled, children, style, ...rest },
  ref,
) {
  const base: React.CSSProperties = {
    minHeight: "var(--min-touch-target)",
    minWidth: "var(--min-touch-target)",
    padding: "10px 20px",
    borderRadius: "10px",
    fontSize: "var(--text-base)",
    fontWeight: 600,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    border: "2px solid transparent",
    ...style,
  };

  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? { background: "var(--color-primary)", color: "#ffffff" }
      : variant === "danger-text"
        ? { background: "transparent", color: "var(--color-error)", border: "2px solid var(--color-error)" }
        : { background: "var(--color-card)", color: "var(--color-text)", border: "2px solid var(--color-border)" };

  return (
    <button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} style={{ ...base, ...variantStyle }} {...rest}>
      {loading ? "Please wait..." : children}
    </button>
  );
});
