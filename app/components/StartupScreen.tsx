"use client";

export default function StartupScreen({ stage = "Initializing command systems" }: { stage?: string }) {
  return <main className="startup-screen" role="status" aria-live="polite">
    <div className="startup-stars" />
    <div className="startup-gate" aria-hidden="true"><i /><i /><i /><span /><b /></div>
    <img src="/horizon-logo.png" alt="Horizon: Shattered Reach" />
    <div className="startup-progress"><i /></div>
    <p>{stage}</p>
    <small>PLAYTEST BUILD 0.35.4</small>
  </main>;
}
