"use client";

import { marketRate } from "../../../game";
import type { GameState, Resource, RoomCommand } from "../../../game";

const marketResources = ["material", "currency", "research"] as const;

export default function NetworkEconomyPanel({ game, playerId, busy, onCommand }: {
  game: GameState;
  playerId: number;
  busy: boolean;
  onCommand: (command: RoomCommand) => Promise<void>;
}) {
  const player = game.players[playerId];
  const exchanges = marketResources.flatMap((give) => marketResources.filter((get) => get !== give).map((get) => ({ give, get, rate: marketRate(player, give, get) })));
  return <div className="network-economy">
    <header className="network-panel-header"><span>SYSTEM ECONOMY</span><h3>Market and Resources</h3><p>Market exchanges happen immediately and do not consume a sealed Order. Rates improve with Economy Technology.</p></header>
    <div className="economy-balance-grid">{(["material", "currency", "research", "influence"] as Resource[]).map((resource) => <div key={resource}><span>{resource}</span><b>{player.resources[resource]}</b></div>)}<div><span>labor</span><b>{player.labor}/{player.laborCap}</b></div></div>
    {(player.faction === "varkesh" || player.faction === "farbound") && <section className="network-action-card"><h4>Next Homeworld production</h4><p>Choose which faction resource the Homeworld produces during the next Production Phase.</p><div className="market-exchange-grid">{(player.faction === "varkesh" ? ["material", "currency"] : ["research", "currency"]).map((resource) => <button key={resource} className={player.homeProductionChoice === resource ? "active" : ""} disabled={busy} onClick={() => void onCommand({ kind: "setHomeProduction", resource: resource as "material" | "currency" | "research" })}><span>{resource}</span><b>{player.homeProductionChoice === resource ? "Selected" : "Choose"}</b></button>)}</div></section>}
    <section className="network-action-card"><h4>System Market · Economy {player.tech.Economy}</h4><div className="market-exchange-grid">{exchanges.map(({ give, get, rate }) => <button key={`${give}-${get}`} disabled={busy || !rate || player.resources[give] < rate} title={!rate ? "Unavailable at your Economy level" : player.resources[give] < rate ? `Requires ${rate} ${give}` : `Exchange ${rate} ${give} for 1 ${get}`} onClick={() => void onCommand({ kind: "marketExchange", give, get })}><span>{give} → {get}</span><b>{rate ? `${rate} : 1` : "Locked"}</b></button>)}</div></section>
    {player.faction === "meridian" && <section className="network-action-card"><h4>Meridian Economic Salvage</h4><p>Remove exactly 4 controlled Combat Units to gain 1 Currency. Uncrewed military vessels are destroyed.</p><button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "economicSalvage" })}>Salvage 4 CU</button></section>}
  </div>;
}
