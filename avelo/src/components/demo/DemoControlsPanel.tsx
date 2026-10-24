"use client";

/**
 * DemoControlsPanel (Task 7.1): a discreet, clearly-labeled drawer
 * reachable from any screen without navigating away. Lets a presenter
 * load fictional example data for a chosen scenario and reset the app.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBooking } from "@/components/booking/BookingProvider";
import { Button } from "@/components/ui/Button";
import type { DemoScenarioId } from "@/domain/types";

const SCENARIO_OPTIONS: { id: DemoScenarioId; label: string }[] = [
  { id: "standard", label: "Standard Arrangement" },
  { id: "special-request-revision", label: "Special Request / Price Revision" },
  { id: "replacement", label: "Replacement" },
  { id: "unavailable-provider", label: "Unavailable Provider (optional)" },
];

export function DemoControlsPanel() {
  const router = useRouter();
  const { loadScenario, reset } = useBooking();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DemoScenarioId>("standard");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/load-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: selected }),
      });
      if (!response.ok) {
        setError("Could not load that scenario.");
        return;
      }
      const body = await response.json();
      loadScenario(body.form, body.scenarioId);
      router.push("/booking");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await reset();
      router.push("/");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 40 }}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open demo controls"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "999px",
            padding: "8px 14px",
            fontSize: "var(--text-sm)",
            minHeight: "var(--min-touch-target)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        >
          Demo Controls
        </button>
      )}
      {open && (
        <div
          role="region"
          aria-label="Demo Controls (simulation tooling, not part of the caregiver experience)"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            padding: "var(--space-md)",
            width: 280,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <strong style={{ fontSize: "var(--text-sm)" }}>Demo Controls</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close demo controls">
              ✕
            </button>
          </div>
          <p style={{ fontSize: "var(--text-sm)", opacity: 0.8, marginBottom: "8px" }}>
            For demonstration only. Loads fictional example data and simulated providers.
          </p>
          <label htmlFor="demo-scenario" style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "4px" }}>
            Demo scenario
          </label>
          <select
            id="demo-scenario"
            value={selected}
            onChange={(e) => setSelected(e.target.value as DemoScenarioId)}
            style={{ width: "100%", marginBottom: "8px", minHeight: "var(--min-touch-target)" }}
          >
            {SCENARIO_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          {error && (
            <p role="alert" style={{ color: "var(--color-error)", fontSize: "var(--text-sm)" }}>
              ⚠ {error}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button type="button" onClick={handleLoad} loading={loading}>
              Load Example Data
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset} loading={resetting}>
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
