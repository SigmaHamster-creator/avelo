/**
 * Design tokens (Task 0.2). These values are the single documented source
 * of truth for the warm, calm, approachable visual baseline (Requirement
 * 87-89) and MUST match the literal values used in globals.css.
 */
export const COLORS = {
  background: "#FBF6EC", // cream
  card: "#FFFFFF", // white cards
  text: "#1F3B2C", // dark green
  primary: "#3F8E8B", // soft teal
  primaryHover: "#2F6E6B",
  error: "#B3261E", // accessible red (contrast-checked against white)
  errorBackground: "#FBEAE9",
  border: "#D8CFBB",
  focusRing: "#1F3B2C",
} as const;

export const TYPE_SCALE = {
  sm: "0.95rem",
  base: "1.1rem",
  lg: "1.3rem",
  xl: "1.6rem",
  xxl: "2.1rem",
  xxxl: "2.75rem",
} as const;

export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

/** Minimum touch target size per Requirement 88. */
export const MIN_TOUCH_TARGET_PX = 44;

/** Breakpoints (px) so the same tokens scale cleanly mobile -> desktop (Requirement 8). */
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
} as const;
