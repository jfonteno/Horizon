import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horizon: Shattered Reach",
  description: "Horizon 0.20.2, a persistent online strategy playtest with illustrated faction selection.",
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
