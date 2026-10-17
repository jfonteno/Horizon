"use client";

import type { GameState, Resource } from "../../../game";
import { productionForecast } from "../../../game/rules/production-forecast";
import { ResourceGlyph, type DisplayResource } from "./ResourceGlyph";

const resources: DisplayResource[] = ["material", "currency", "research", "influence", "labor", "legacy"];

export default function NetworkResourcesPanel({ game, playerId }: { game: GameState; playerId: number }) {
  const player = game.players[playerId];
  const forecast = productionForecast(game, playerId);
  return <div className="network-resources-panel">
    <header className="network-panel-header"><span>COMMAND RESERVES</span><h3>Current Resources</h3><p>Your available stock, Labor capacity, Legacy Points, and expected recurring production.</p></header>
    <div className="resource-drawer-grid">{resources.map((resource) => <div key={resource} className={`resource-${resource}`}>
      <ResourceGlyph resource={resource} label={false}/><span>{resource}</span>
      <strong>{resource === "labor" ? `${player.labor}/${player.laborCap}` : resource === "legacy" ? player.lp : player.resources[resource as Resource]}</strong>
      <small>{resource === "labor" ? `Next capacity ${forecast.laborCap}` : resource === "legacy" ? "Current public score" : `+${forecast.totals[resource as Resource]} next production`}</small>
    </div>)}</div>
    <section className="resource-drawer-sources"><h4>Production sources</h4><p>Expected recurring output from current holdings. New construction, trades, and combat can change the result.</p>
      {forecast.sources.map((source, index) => <div key={`${source.hexId}-${source.label}-${index}`} className={`resource-${source.resource}`}><ResourceGlyph resource={source.resource} label={false}/><span><b>{source.hexId}</b> {source.label}</span><strong>+{source.amount}</strong></div>)}
      {!forecast.sources.length && <p>No recurring resource production is currently recorded.</p>}
    </section>
  </div>;
}
