"use client";

import { evaluateLegacy, removeCapturedCenter } from "../../game";
import type { GameState } from "../../game";

export default function CaptureDecision({ game, commit, flash }: { game: GameState; commit: (game: GameState) => void; flash: (message: string) => void }) {
  const pending = game.pendingCenterLoss;
  if (!pending) return null;
  const habitat = game.hexes.find(hex => hex.id === pending.hexId)!;
  const player = game.players[pending.playerId];

  function remove(index: number) {
    const draft = structuredClone(game);
    const result = removeCapturedCenter(draft, pending!.playerId, index);
    flash(result.message);
    if (result.ok) { evaluateLegacy(draft); commit(draft); }
  }

  return <div className="handoff-overlay capture-overlay" role="dialog" aria-modal="true"><div className="handoff-card"><p>CAPTURE RESOLUTION // {habitat.id}</p><h1>Choose {pending.removeCount} Center{pending.removeCount === 1 ? "" : "s"} to destroy</h1><span>{player.name} captured a Habitat that lost Center slots. Select the excess infrastructure that does not survive the capture.</span><div className="captured-centers">{habitat.centers.map((center, index) => <button key={`${center}-${index}`} onClick={() => remove(index)}><b>{center === "defense" ? "Defense Grid" : `${center[0].toUpperCase()}${center.slice(1)} Center`}</b><small>Destroy this Center</small></button>)}</div></div></div>;
}
