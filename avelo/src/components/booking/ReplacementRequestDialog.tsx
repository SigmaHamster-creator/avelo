"use client";

/**
 * ReplacementRequestDialog (Task 6.4): keyboard-operable modal with a
 * focus trap and focus-return-on-close, collecting a required reason.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface ReplacementRequestDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function ReplacementRequestDialog({ open, onClose, onSubmit, triggerRef }: ReplacementRequestDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
    }
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      handleClose();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>("button, textarea, input, [tabindex]");
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleClose() {
    setReason("");
    setError(null);
    onClose();
    triggerRef.current?.focus();
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Please describe why you'd like a different arrangement.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      setReason("");
    } catch {
      setError("We couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(31,59,44,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replacement-dialog-title"
        style={{ background: "var(--color-card)", borderRadius: "var(--radius)", padding: "var(--space-lg)", maxWidth: 480, width: "90%" }}
      >
        <h2 id="replacement-dialog-title" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-sm)" }}>
          Request a Different Arrangement
        </h2>
        <label htmlFor="replacement-reason" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
          Why would you like a different arrangement?
        </label>
        <textarea
          id="replacement-reason"
          ref={firstFieldRef}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ width: "100%", borderRadius: "8px", border: "2px solid var(--color-border)", padding: "8px" }}
        />
        {error && (
          <p role="alert" style={{ color: "var(--color-error)", marginTop: "8px" }}>
            ⚠ {error}
          </p>
        )}
        <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
          <Button type="button" onClick={handleSubmit} loading={submitting}>
            Request Replacement
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
