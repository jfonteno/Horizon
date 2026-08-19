import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horizon: Shattered Reach",
  description: "Horizon 0.5.0, a local hot-seat playtest of fleet operations, diplomacy, and deterministic warfare on Shattered Reach.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
