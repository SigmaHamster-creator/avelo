"use client";

/**
 * Landing screen (Task 1.1): brand, tagline, short explanation, the single
 * "Schedule a Ride" CTA, and a concise non-emergency statement -- stated
 * once here, not repeated throughout the flow (Requirement 3).
 */
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LandingPage() {
  return (
    <div>
      <Card style={{ textAlign: "center", maxWidth: 640 }}>
        <h1 style={{ fontSize: "var(--text-xxxl)", color: "var(--color-primary)", marginBottom: "var(--space-sm)" }}>
          Avelo
        </h1>
        <p style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-md)" }}>
          Every journey, thoughtfully arranged.
        </p>
        <p style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-lg)" }}>
          Scheduled rides for your loved ones, matched to their needs. Describe your passenger&apos;s trip once, and
          Avelo coordinates a suitable provider for the ride to a medical appointment and back home.
        </p>
        <Link href="/booking">
          <Button type="button" style={{ fontSize: "var(--text-lg)", padding: "14px 28px" }}>
            Schedule a Ride
          </Button>
        </Link>
        <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-lg)", opacity: 0.85 }}>
          Avelo is for scheduled, non-emergency transportation only. For a medical emergency, call 911.
        </p>
      </Card>
    </div>
  );
}
