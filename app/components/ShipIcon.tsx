import type { CSSProperties } from "react";
import type { ShipIconType } from "../../game/themes/assets";

type Props = {
  type: ShipIconType;
  color?: string;
  className?: string;
  title?: string;
};

const silhouettes: Record<ShipIconType, React.ReactNode> = {
  patrol: <><path d="M5 23 19 14l24 1 15 8-15 3-24-1Z"/><path d="m21 14 6-7 10 8M22 25l6 7 10-6"/></>,
  transport: <><path d="M5 18 15 10h31l13 10-13 10H15L5 24Z"/><rect x="20" y="13" width="21" height="14" rx="4"/></>,
  frigate: <><path d="m4 23 17-12h21l18 11-18 6H21Z"/><path d="m25 11 6-7 9 8M28 28l6 7 9-9"/></>,
  assault: <><path d="M3 21 18 9h27l16 11-13 10H18Z"/><path d="m40 11 7-7 4 4-4 7M41 27l8 8 4-4-5-8"/></>,
  cruiser: <><path d="M3 22 16 12l11-2 6-7 7 8 10 2 12 9-14 7H17Z"/><path d="M18 17h28M19 24h31"/></>,
  heavyTransport: <><path d="M4 17 15 7h35l11 10v9L50 34H15L4 25Z"/><rect x="17" y="11" width="30" height="19" rx="5"/><path d="M22 7V2h20v5"/></>,
  battleship: <><path d="M2 22 16 10l12-2 5-7 7 8 13 4 10 9-13 8-34-2Z"/><path d="M14 18h36M18 24h38M25 12l-4-8M44 13l5-8"/></>,
  fleetTransport: <><path d="M3 16 14 5h37l11 11v11L51 36H14L3 26Z"/><rect x="15" y="9" width="34" height="23" rx="6"/><path d="M21 5V1h22v4M10 20h44"/></>,
  corvette: <><path d="M4 22 25 9l18 4 17 9-19 6-18-3Z"/><path d="m25 9 8-7 5 10M24 25l10 9 5-7"/></>,
  xebec: <><path d="M2 22 17 12 30 3l7 10 13 1 12 8-15 9H18Z"/><path d="M30 3v25M18 12l-5-8M48 14l7-8"/></>,
  explorer: <><path d="m5 22 21-9 7-10 6 10 20 9-21 6-11-2Z"/><circle cx="34" cy="18" r="4"/></>,
  surveyVessel: <><path d="m5 23 18-10 11 2 8-8 5 10 12 6-17 7-20-3Z"/><path d="M34 15V5M29 7h10"/><circle cx="34" cy="5" r="2"/></>,
  deepSurvey: <><path d="M4 23 18 12l14-2 6-8 7 10 15 11-18 7-23-3Z"/><ellipse cx="35" cy="17" rx="10" ry="5"/><path d="M24 9 17 3M48 11l7-7"/></>,
  pathfinder: <><path d="M3 22 21 9l12-7 9 10 19 10-21 8-20-4Z"/><path d="m33 2 2 26M21 9l-5-7M43 12l8-8"/><circle cx="35" cy="15" r="4"/></>,
  colonyShip: <><path d="M4 22 16 10h30l14 12-14 11H16Z"/><circle cx="31" cy="21" r="10"/><path d="M31 11V5M21 21h-8M41 21h8"/></>,
  prospector: <><path d="M5 23 18 12h25l16 11-15 8H18Z"/><path d="m42 12 8-9 5 4-7 10M25 13l-5-8M29 26l-7 8"/></>,
  envoy: <><path d="M5 22 20 11h23l16 11-16 9H20Z"/><path d="M31 11V3l7 4-7 4M25 18h18M25 24h18"/></>,
  surveyor: <><path d="M4 23 19 12h23l17 11-17 7H19Z"/><circle cx="32" cy="18" r="7"/><path d="M32 11V2M24 12 18 5M40 12l7-7"/></>,
};

export default function ShipIcon({ type, color = "currentColor", className = "", title }: Props) {
  return (
    <svg
      className={`ship-icon ${className}`}
      viewBox="0 0 64 40"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ "--ship-color": color } as CSSProperties}
    >
      {title && <title>{title}</title>}
      <g>{silhouettes[type]}</g>
    </svg>
  );
}
