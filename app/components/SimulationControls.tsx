"use client";

import type { GameState } from "../../game";

const speeds = [
  { label: "0.5×", value: 1200 },
  { label: "1×", value: 650 },
  { label: "2×", value: 250 },
  { label: "MAX", value: 50 },
];

export default function SimulationControls({ game, paused, speed, setPaused, setSpeed, step }:{
  game: GameState;
  paused: boolean;
  speed: number;
  setPaused: (paused:boolean)=>void;
  setSpeed: (speed:number)=>void;
  step: ()=>void;
}) {
  const active = game.players[game.active];
  return <section className="simulation-controls" aria-label="Simulation controls">
    <div><span>SPECTATOR SIMULATION</span><b>{active.name}</b><small>{game.orderProtocol.phase === "ready" ? "Resolving sealed Orders" : "Planning private Orders"}</small></div>
    <button className={paused ? "resume" : ""} onClick={()=>setPaused(!paused)}>{paused ? "Resume" : "Pause"}</button>
    <button onClick={step}>Step</button>
    <div className="simulation-speeds" aria-label="Simulation speed">
      {speeds.map((option)=><button key={option.value} className={speed===option.value?"active":""} onClick={()=>setSpeed(option.value)}>{option.label}</button>)}
    </div>
  </section>;
}
