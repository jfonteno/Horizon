"use client";

import { useState } from "react";
import type { GameState, TurnReplay } from "../../../game";
import { mapLibrary } from "../../../game";
import { hexColumnClass, mapCanvasDimensions } from "../../lib/map-geometry";

function center(game: GameState, hexId: string) {
  const hex = game.hexes.find((candidate) => candidate.id === hexId);
  if (!hex) return { x: 0, y: 0 };
  return { x: 44 + (hex.col + .5) * 148, y: 36 + (hex.row + .5) * 132 + (hex.col % 2 ? 66 : 0) };
}

function changeLabel(change: TurnReplay["hexChanges"][number]) {
  const details: string[] = [];
  if (change.tierAfter !== change.tierBefore) details.push(change.tierAfter ? `${change.tierAfter} established` : "Habitat lost");
  if (change.centersAdded.length) details.push(`${change.centersAdded.join(", ")} Center${change.centersAdded.length === 1 ? "" : "s"}`);
  if (change.unitsAdded.length) details.push(change.unitsAdded.join(", "));
  if (change.combatUnitDelta) details.push(`${change.combatUnitDelta > 0 ? "+" : ""}${change.combatUnitDelta} CU`);
  if (change.ownerAfter !== change.ownerBefore) details.push("Control changed");
  return details.join(" · ") || "Sector updated";
}

export default function TurnReplayOverlay({ game, initialTurn, close }: { game: GameState; initialTurn?: number; close: () => void }) {
  const records = [...(game.turnReplays || [])].sort((a, b) => b.turn - a.turn);
  const [turn, setTurn] = useState(initialTurn || records[0]?.turn || 0);
  const replay = records.find((record) => record.turn === turn) || records[0];
  const map = mapLibrary[game.mapId];
  const canvas = mapCanvasDimensions(map.columns, map.rows);
  if (!replay) return null;
  return <div className="turn-replay-overlay" role="dialog" aria-modal="true" aria-labelledby="turn-replay-title">
    <section className="turn-replay-shell">
      <header><div><span>PUBLIC RESOLUTION ARCHIVE</span><h2 id="turn-replay-title">Previous Orders</h2></div><label>Turn <select value={replay.turn} onChange={(event) => setTurn(Number(event.target.value))}>{records.map((record) => <option value={record.turn} key={record.turn}>Era {record.era}, Turn {record.turn}</option>)}</select></label><button onClick={close}>Close</button></header>
      <div className="turn-replay-layout">
        <div className="turn-replay-map-viewport">
          <div className="turn-replay-map" style={{ width: canvas.width, height: canvas.height, "--map-columns": map.columns, "--map-rows": map.rows } as React.CSSProperties}>
            <div className="replay-hex-grid">{game.hexes.map((hex) => <div key={hex.id} className={`replay-hex ${hexColumnClass(hex.col)} ${hex.kind}`} style={{ gridColumn: hex.col + 1, gridRow: hex.row + 1 }}><span>{hex.id}</span></div>)}</div>
            <svg viewBox={`0 0 ${canvas.width} ${canvas.height}`} aria-label="Resolved unit movement paths">
              <defs>{game.players.map((player) => <marker key={player.id} id={`replay-arrow-${player.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={player.color}/></marker>)}</defs>
              {replay.movements.map((movement, index) => {
                const points = (movement.path.length ? movement.path : [movement.fromHexId, movement.toHexId]).map((id) => center(game, id));
                return <g key={`${movement.playerId}-${movement.unitIds.join("-")}-${index}`} className={movement.outcome}>
                  <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={game.players[movement.playerId]?.color || "#fff"} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#replay-arrow-${movement.playerId})`} />
                  <circle cx={points[0].x} cy={points[0].y} r="9" fill={game.players[movement.playerId]?.color || "#fff"}/>
                  <text x={points.at(-1)!.x + 12} y={points.at(-1)!.y - 12}>{movement.unitIds.length} {movement.unitKind}</text>
                </g>;
              })}
              {replay.hexChanges.map((change) => { const point = center(game, change.hexId); return <g className="replay-change" key={change.hexId}><circle cx={point.x} cy={point.y} r="22"/><text x={point.x} y={point.y + 5}>+</text></g>; })}
            </svg>
          </div>
        </div>
        <aside className="turn-replay-summary">
          <span>ERA {replay.era} · TURN {replay.turn}</span>
          <h3>Resolution summary</h3>
          {replay.factions.map((change) => {
            const player = game.players[change.playerId];
            const details = [
              ...change.technologyAdvanced.map((branch) => `${branch} advanced`),
              ...(change.gateContributions ? [`${change.gateContributions} Gate contribution${change.gateContributions === 1 ? "" : "s"}`] : []),
              ...(change.combatUnitsPurchased ? [`${change.combatUnitsPurchased} CU purchased`] : []),
              ...(change.habitatDelta ? [`${change.habitatDelta > 0 ? "+" : ""}${change.habitatDelta} Habitats`] : []),
              ...(change.legacyDelta ? [`+${change.legacyDelta} LP`] : []),
            ];
            return details.length ? <article key={change.playerId} style={{ "--replay-faction": player.color } as React.CSSProperties}><b>{player.name}</b>{details.map((detail) => <small key={detail}>{detail}</small>)}</article> : null;
          })}
          {!!replay.hexChanges.length && <section><h4>Board changes</h4>{replay.hexChanges.map((change) => <p key={change.hexId}><b>{change.hexId}</b> {changeLabel(change)}</p>)}</section>}
          {!replay.movements.length && !replay.hexChanges.length && <p>No public map changes occurred this Turn.</p>}
        </aside>
      </div>
    </section>
  </div>;
}
