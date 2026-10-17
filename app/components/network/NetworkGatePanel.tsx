"use client";

import { factionLibrary, finalEra, formatPurchaseCost, gateTarget, projectedOrderBudget, purchaseCostForOrder, tributeCosts } from "../../../game";
import type { GameState, Resource, SecretOrder } from "../../../game";
import { ResourceGlyph, type DisplayResource } from "./ResourceGlyph";

export default function NetworkGatePanel({ game, playerId, draft, setDraft, notify }: {
  game: GameState;
  playerId: number;
  draft: SecretOrder[];
  setDraft: React.Dispatch<React.SetStateAction<SecretOrder[]>>;
  notify: (message: string) => void;
}) {
  const player = game.players[playerId];
  const goal = gateTarget(game);
  const tributes = draft.filter((order) => order.kind === "tribute");
  const alreadyContributed = (player.eraTributes[game.era - 1] || 0) > 0;
  const candidate = [...draft, { id: "tribute-budget-preview", kind: "tribute" as const }];
  const budget = projectedOrderBudget(game, playerId, candidate);
  const reserved = projectedOrderBudget(game, playerId, draft).remaining;
  const cost = purchaseCostForOrder(game, playerId, { id: "tribute-cost-preview", kind: "tribute" }) || tributeCosts[game.era];
  const leaderTotal = Math.max(0, ...game.players.map((faction) => faction.tributes));
  const blocked = game.gate >= goal || (game.era < finalEra(game) && (alreadyContributed || tributes.length > 0)) || Boolean(budget.error);

  function add() {
    if (blocked) return notify(budget.error || (game.gate >= goal ? "The Horizon Gate is complete." : "Only one Tribute may be submitted in this Era."));
    setDraft([...draft, { id: `tribute-${globalThis.crypto?.randomUUID?.() || Date.now()}`, kind: "tribute" }]);
    notify("Gate Tribute added to your private Orders.");
  }

  function removeLast() {
    const index = draft.findLastIndex((order) => order.kind === "tribute");
    if (index < 0) return;
    setDraft([...draft.slice(0, index), ...draft.slice(index + 1)]);
    notify("Gate Tribute removed from your private Orders.");
  }

  return <div className="network-gate">
    <header className="network-panel-header"><span>SHARED SURVIVAL PROJECT</span><h3>Horizon Gate</h3><p>Tributes are sealed with your other Orders and resolve simultaneously.</p></header>
    <div className="gate-progress-card"><strong>{game.gate}<small> / {goal}</small></strong><div><span style={{ width: `${Math.min(100, game.gate / goal * 100)}%` }} /></div><p>{Math.max(0, goal - game.gate)} shared Tribute{goal - game.gate === 1 ? "" : "s"} still required</p></div>
    <section className="gate-tribute-action"><button className="primary wide" disabled={blocked} title={blocked ? budget.error || "Tribute unavailable" : "Add a Tribute Order"} onClick={add}>{game.gate >= goal ? "Gate complete" : alreadyContributed && game.era < finalEra(game) ? "Era contribution already made" : "Add Tribute Order"}</button><h4>Era {game.era} Tribute cost</h4><div className="gate-resource-cost">{Object.entries(cost).filter(([, amount]) => amount > 0).map(([resource, amount]) => {
      const have = resource === "labor" ? reserved.labor : reserved.resources[resource as Resource];
      return <span className={`resource-${resource} ${have < amount ? "missing" : ""}`} key={resource} title={`${resource}: ${have} available, ${amount} required`}><ResourceGlyph resource={resource as DisplayResource} label={false}/><b>{amount}</b><small>{resource}</small>{have < amount && <em>{have} available</em>}</span>;
    })}</div><p>{game.era < finalEra(game) ? "Each civilization may contribute once during this Era." : `Era ${game.era} permits multiple affordable Tributes in the same Turn.`}</p>{budget.error && <small className="action-reason">{budget.error}</small>}</section>
    <section className="network-order-preview"><h4>Gate Orders in draft</h4>{tributes.map((order, index) => <div key={order.id}><span>Tribute {index + 1} · {formatPurchaseCost(tributeCosts[game.era])}</span><button onClick={removeLast}>Remove</button></div>)}{!tributes.length && <p>No Gate Tribute drafted this Turn.</p>}</section>
    <div className="unit-readout"><span>Your total contributions <b>{player.tributes}</b></span><span>This Era <b>{player.eraTributes[game.era - 1] || 0}</b></span></div>
    <section className="gate-ledger"><h4>Faction contributions</h4><div className="gate-faction-list">{game.players.map((faction) => <div key={faction.id} className={`gate-faction-row ${leaderTotal > 0 && faction.tributes === leaderTotal ? "leader" : ""}`} style={{ "--faction-color": faction.color } as React.CSSProperties}><img src={factionLibrary[faction.faction].logo} alt="" /><div><b>{faction.name}</b><small>{Array.from({ length: finalEra(game) }, (_, index) => `Era ${index + 1}: ${faction.eraTributes[index] || 0}`).join(" · ")}</small></div><strong>{faction.tributes}<small> total</small></strong>{leaderTotal > 0 && faction.tributes === leaderTotal && <em>Leader</em>}</div>)}</div><details><summary>Contribution history</summary>{(game.gateLedger || []).map((entry, index) => <p key={index}>Turn {entry.turn}, Era {entry.era}: {game.players[entry.playerId].name} contributed {formatPurchaseCost(entry.cost)}.</p>)}{!(game.gateLedger || []).length && <p>Earlier totals remain visible above.</p>}</details></section>
  </div>;
}
