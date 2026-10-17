"use client";

import { civilizationLegacy, factionLibrary, legacyObjectiveProgress, totalCombatUnits, type GameState, type Resource } from "../../../game";

function production(game: GameState, playerId: number) {
  const player = game.players[playerId];
  const multiplier = player.tech.Resource === 4 ? 2 : 1;
  const result: Record<Resource | "labor", number> = { material: 0, currency: 0, research: 0, influence: 0, labor: 3 + player.laborBonus };
  const defaultHome = factionLibrary[player.faction].homeProduction;
  const home = player.homeProductionChoice || defaultHome;
  result[home] += multiplier;
  for (const hex of game.hexes.filter((candidate) => candidate.owner === playerId)) {
    if (["material", "currency", "research", "influence"].includes(hex.kind)) result[hex.kind as Resource] += multiplier;
    if (hex.kind === "labor") result.labor += multiplier;
    for (const center of hex.centers) {
      if (center === "labor") result.labor += multiplier;
      else if (["material", "currency", "research", "influence"].includes(center)) result[center as Resource] += multiplier;
    }
  }
  return result;
}

export default function FactionStatusOverlay({ game, playerId, close, openDiplomacy }: { game: GameState; playerId: number; close: () => void; openDiplomacy?: (playerId: number) => void }) {
  const player = game.players[playerId];
  const faction = factionLibrary[player.faction];
  const habitats = game.hexes.filter((hex) => hex.owner === player.id && hex.tier);
  const centers = habitats.reduce((sum, hex) => sum + hex.centers.length, 0);
  const output = production(game, player.id);
  const objectives = civilizationLegacy[player.faction] || [];
  return <div className="faction-status-overlay" role="dialog" aria-modal="true" aria-labelledby="faction-status-title"><article style={{ "--status-faction": player.color } as React.CSSProperties}>
    <header><img src={faction.logo} alt=""/><div><span>PUBLIC CIVILIZATION STATUS</span><h2 id="faction-status-title">{player.name}</h2><p>{faction.role}</p></div><button onClick={close}>Close</button></header>
    <div className="faction-public-metrics">
      <section><span>Resources</span><b>{Object.entries(player.resources).map(([resource, amount]) => `${resource.slice(0,3).toUpperCase()} ${amount}`).join(" · ")}</b><small>Labor {player.labor}/{player.laborCap}</small></section>
      <section><span>Infrastructure</span><b>{habitats.length} Habitats · {centers} Centers</b><small>{habitats.map((hex) => `${hex.id} ${hex.tier}`).join(" · ")}</small></section>
      <section><span>Production next Turn</span><b>{Object.entries(output).map(([resource, amount]) => `${resource.slice(0,3).toUpperCase()} +${amount}`).join(" · ")}</b></section>
      <section><span>Military</span><b>{totalCombatUnits(game, player.id)} Combat Units</b><small>{game.carriers.filter((unit) => unit.owner === player.id).length} military vessels</small></section>
      <section><span>Horizon Gate</span><b>{player.tributes} total contributions</b><small>Era ledger {player.eraTributes.map((amount, index) => `E${index + 1}: ${amount}`).join(" · ")}</small></section>
      <section><span>Technology</span><b>{Object.entries(player.tech).map(([branch, level]) => `${branch} ${level}`).join(" · ")}</b></section>
    </div>
    <section className="faction-objective-progress"><h3>Civilization Legacy objectives</h3>{objectives.map((objective) => { const progress = legacyObjectiveProgress(game, player.id, objective.id); return <div key={objective.id} className={progress.complete ? "complete" : ""}><span><b>{objective.name}</b><small>{objective.condition}</small></span><strong>{progress.label}</strong></div>; })}</section>
    {openDiplomacy && <button className="primary" onClick={() => { close(); openDiplomacy(player.id); }}>Open diplomacy with {player.name}</button>}
  </article></div>;
}
