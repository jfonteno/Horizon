import type { Metadata } from "next";
import "./globals.css";
import "./playtest-0210.css";
import "./application-shell.css";
import "./ui-update.css";
import PwaLifecycle from "./components/PwaLifecycle";
import InterfaceClick from "./components/InterfaceClick";

export const metadata: Metadata = {
  title: "Horizon: Shattered Reach",
  description: "Horizon 0.35.4 playtest: vertical Technology Tree with universal rules and faction-specific unlocks.",
  manifest: "/manifest.webmanifest",
  applicationName: "Horizon: Shattered Reach",
  themeColor: "#061820",
  appleWebApp: { capable:true, title:"Horizon", statusBarStyle:"black-translucent" },
  icons: { icon:"/icons/favicon-64.png", apple:"/icons/apple-touch-icon.png" },
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a>{children}<PwaLifecycle /><InterfaceClick /></body></html>;
}
