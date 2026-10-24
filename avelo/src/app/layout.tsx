import type { Metadata } from "next";
import "./globals.css";
import { BookingProvider } from "@/components/booking/BookingProvider";
import { DemoControlsPanel } from "@/components/demo/DemoControlsPanel";
import { LiveRegionProvider } from "@/components/a11y/LiveRegionProvider";

export const metadata: Metadata = {
  title: "Avelo - Every journey, thoughtfully arranged.",
  description:
    "Avelo helps caregivers schedule non-emergency medical transportation for a loved one, with a clear estimate and a simulated provider match.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <BookingProvider>
          <LiveRegionProvider>
            <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border)" }}>
              <strong style={{ fontSize: "var(--text-lg)", color: "var(--color-primary)" }}>Avelo</strong>
            </header>
            <main id="main-content" className="app-shell" style={{ flex: 1, padding: "24px" }}>
              {children}
            </main>
            <footer style={{ padding: "16px 24px", fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
              Avelo coordinates non-emergency transportation only. It does not provide emergency dispatch or clinical
              triage. Provider matching shown in this demo is simulated.
            </footer>
            <DemoControlsPanel />
          </LiveRegionProvider>
        </BookingProvider>
      </body>
    </html>
  );
}
