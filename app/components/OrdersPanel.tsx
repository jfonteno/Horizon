"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  beginSecretOrders,
  formatPurchaseCost,
  orderLabel,
  projectedOrderBudget,
  purchaseCostForOrder,
  resolveSecretOrders,
  submitSecretOrders,
  totalOrderCost,
} from "../../game";
import type { GameState, Resource, SecretOrder } from "../../game";

export default function OrdersPanel({
  game,
  commit,
  flash,
  draft,
  setDraft,
  openDiplomacy,
  openLegacy,
}: {
  game: GameState;
  commit: (game: GameState) => void;
  flash: (message: string) => void;
  draft: SecretOrder[];
  setDraft: Dispatch<SetStateAction<SecretOrder[]>>;
  openDiplomacy: () => void;
  openLegacy: () => void;
}) {
  const [handoff, setHandoff] = useState(false);
  const protocol = game.orderProtocol;
  const player = game.players[game.active];

  const mutate = (action: (next: GameState) => { ok: boolean; message: string }) => {
    const next = structuredClone(game);
    const result = action(next);
    flash(result.message);
    if (result.ok) commit(next);
  };

  if (protocol.phase === "negotiation")
    return <div className="orders-console">
      <h3>Negotiation Phase</h3>
      <p>Complete negotiations before beginning the private Orders handoff.</p>
      <button className="primary wide" onClick={() => mutate((next) => beginSecretOrders(next))}>Begin secret Orders</button>
      <button className="wide negotiation-link" onClick={openDiplomacy}>Open Trade &amp; Diplomacy</button>
    </div>;

  if (protocol.phase === "ready")
    return <div className="orders-console ready-orders">
      <span>ALL {game.players.length} CIVILIZATIONS SEALED</span>
      <h3>Orders ready for simultaneous resolution</h3>
      <p>Orders remain concealed until the engine resolves the complete batch.</p>
      <button className="primary wide" onClick={() => mutate((next) => resolveSecretOrders(next))}>Reveal and resolve all Orders</button>
    </div>;

  const budget = projectedOrderBudget(game, player.id, draft);
  const total = totalOrderCost(game, player.id, draft);
  const resources = ["material", "currency", "research", "influence"] as Resource[];
  const hiddenRequired = (game.turn - 1) % 4 === 0 && !player.hiddenLegacy[game.era]?.selected;

  return <div className="orders-console">
    <div className="orders-identity">
      <span>PRIVATE ORDERS // TURN {game.turn}</span>
      <h3>{player.name}</h3>
      <small>{protocol.submissions.length} of {game.players.length} civilizations submitted</small>
    </div>

    <div className="map-first-tip">
      <b>Map-first command</b>
      <span>Select vessels on the map for movement and actions. Use Build and Tech for purchases. This console reviews the complete private draft.</span>
    </div>

    {hiddenRequired && <div className="hidden-required">
      <div><b>Hidden Objective required</b><span>Choose one private Era {game.era} objective before ending this Turn.</span></div>
      <button onClick={openLegacy}>Choose objective</button>
    </div>}

    <div className="projected-budget">
      <div><span>PROJECTED COST</span><strong>{formatPurchaseCost(total)}</strong></div>
      <div className="budget-resources">
        {resources.map((resource) => <span key={resource}><i>{resource[0].toUpperCase()}</i><b>{budget.remaining.resources[resource]}</b></span>)}
        <span><i>L</i><b>{budget.remaining.labor}</b></span>
      </div>
      {budget.error && <p>{budget.error}</p>}
    </div>

    <div className="sealed-draft">
      <h4>Private draft</h4>
      {draft.length ? draft.map((order) => {
        const cost = purchaseCostForOrder(game, player.id, order);
        return <span key={order.id}>
          <span><b>{orderLabel(order)}</b>{cost && <small>{formatPurchaseCost(cost)}</small>}</span>
          <button onClick={() => setDraft((current) => current.filter((candidate) => candidate.id !== order.id))}>Remove</button>
        </span>;
      }) : <small>No Orders drafted. Submitting an empty draft submits Hold.</small>}
    </div>

    <button
      className="primary wide seal-orders"
      disabled={!!budget.error || hiddenRequired}
      onClick={() => {
        const next = structuredClone(game);
        const result = submitSecretOrders(next, player.id, draft);
        flash(result.message);
        if (result.ok) {
          commit(next);
          setDraft([]);
          if (next.orderProtocol.phase === "orders") setHandoff(true);
        }
      }}
    >Submit Orders &amp; End Turn</button>

    {handoff && <div className="handoff-overlay"><div className="handoff-card">
      <p>SECRET ORDERS SUBMITTED</p>
      <h1>Pass the device</h1>
      <span>The next civilization cannot inspect the submitted Orders.</span>
      <button className="primary" onClick={() => setHandoff(false)}>I am {game.players[game.active].name}</button>
    </div></div>}
  </div>;
}
