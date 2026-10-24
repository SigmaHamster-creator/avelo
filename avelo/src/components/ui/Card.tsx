import type { ReactNode } from "react";

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        borderRadius: "var(--radius)",
        padding: "var(--space-lg)",
        boxShadow: "0 1px 3px rgba(31, 59, 44, 0.08)",
        maxWidth: 720,
        marginInline: "auto",
        marginBottom: "var(--space-lg)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
