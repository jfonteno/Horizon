"use client";

import { marketRate } from "../../../game";
import type { GameState, Resource, RoomCommand } from "../../../game";
import { productionForecast } from "../../../game/rules/production-forecast";
import { ResourceGlyph, type DisplayResource } from "./ResourceGlyph";

const marketResources = ["material", "currency", "research"] as const;

export default function NetworkEconomyPanel({ game, playerId, busy, onCommand }: {
  game: GameState;
  playerId: number;
  busy: boolean;
  onCommand: (command: RoomCommand) => Promise<void>;
}) {
  const player = game.players[playerId];
  const forecast = productionForecast(game, playerId);
  const productionLocked = !["negotiation", "orders"].includes(game.orderProtocol.phase) || game.orderProtocol.submissions.some((submission) => submission.playerId === playerId);
  const sources = player.faction === "aurelians" && player.tech.Policy >= 2 ? [...marketResources, "influence" as const] : marketResources;
  const exchanges = sources.flatMap((give) => marketResources.filter((get) => get !== give).map((get) => ({ give, get, rate: marketRate(player, give, get) })));
  return <div className="network-economy">
    <header className="network-panel-header"><span>SYSTEM ECONOMY</span><h3>Market and Resources</h3><p>Market exchanges happen immediately and do not consume a sealed Order. Rates improve with Economy Technology.</p></header>
    <div className="economy-balance-grid">{(["material", "currency", "research", "influence"] as Resource[]).map((resource) => <div key={resource} className={`resource-${resource}`}><span><ResourceGlyph resource={resource} label={false}/>{resource}</span><b>{player.resources[resource]}</b></div>)}<div className="resource-labor"><span><ResourceGlyph resource="labor" label={false}/>labor</span><b>{player.labor}/{player.laborCap}</b></div></div>
    <section className="production-ledger network-action-card"><h4>Next Production forecast</h4><p>Recurring output from current holdings. Drafted construction, trades, combat, and new settlements are not guaranteed here.</p><div className="production-totals">{(["material", "currency", "research", "influence", "labor"] as DisplayResource[]).map((resource) => <span key={resource} className={`resource-${resource}`}><ResourceGlyph resource={resource} label={false}/><b>{resource === "labor" ? `Capacity ${forecast.laborCap}` : `+${forecast.totals[resource as Resource]}`}</b><small>{resource}</small></span>)}</div><details><summary>Where this production comes from</summary><div className="production-source-list">{forecast.sources.map((source, index) => <div key={`${source.hexId}-${source.label}-${index}`} className={`resource-${source.resource}`}><ResourceGlyph resource={source.resource} label={false}/><span><b>{source.hexId}</b> {source.label}</span><strong>+{source.amount}</strong></div>)}<small>Labor refreshes to the displayed capacity at the Production Phase. Conditional income is excluded.</small></div></details></section>
    {(player.faction === "varkesh" || player.faction === "farbound" || player.faction === "helix") && <section className="network-action-card"><h4>{player.faction === "helix" ? "Research Reallocation" : "Next Homeworld production"}</h4><p>Choose Homeworld output before sealing Orders. The selection replaces its usual output and persists until changed. Current forecast: {forecast.sources.find((source) => source.label === "Homeworld")?.resource || "research"}.</p><div className="market-exchange-grid">{(player.faction === "varkesh" ? ["material", "currency"] : player.faction === "helix" ? ["research", "material", "currency"] : ["research", "currency"]).map((resource) => <button key={resource} className={`resource-${resource} ${(player.homeProductionChoice || (player.faction === "varkesh" ? "material" : "research")) === resource ? "active" : ""}`} disabled={busy || productionLocked} onClick={() => void onCommand({ kind: "setHomeProduction", resource: resource as "material" | "currency" | "research" })}><span><ResourceGlyph resource={resource as DisplayResource} label={false}/>{resource}</span><b>{(player.homeProductionChoice || (player.faction === "varkesh" ? "material" : "research")) === resource ? "Selected" : "Choose"}</b></button>)}</div></section>}
    <section className="network-action-card"><h4>System Market · Economy {player.tech.Economy}</h4><div className="market-exchange-grid">{exchanges.map(({ give, get, rate }) => <button key={`${give}-${get}`} className={`resource-${get}`} disabled={busy || !rate || player.resources[give] < rate} title={!rate ? "Unavailable at your Economy level" : player.resources[give] < rate ? `Requires ${rate} ${give}` : `Exchange ${rate} ${give} for 1 ${get}`} onClick={() => void onCommand({ kind: "marketExchange", give, get })}><span className="exchange-path"><span className={`resource-${give}`}><ResourceGlyph resource={give} label={false}/>{give}</span><i aria-hidden="true">→</i><span className={`resource-${get}`}><ResourceGlyph resource={get} label={false}/>{get}</span></span><b>{rate ? `${rate} : 1` : "Locked"}</b></button>)}</div></section>
    {player.faction === "meridian" && <section className="network-action-card"><h4>Meridian Economic Salvage</h4><p>Remove exactly 4 controlled Combat Units to gain 1 Currency. Uncrewed military vessels are destroyed.</p><button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "economicSalvage" })}>Salvage 4 CU</button></section>}
  </div>;
}
