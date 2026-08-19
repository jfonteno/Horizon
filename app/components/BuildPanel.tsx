"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  availableCarrierTypes,
  availableCivilianType,
  carrierLibrary,
  civilianLibrary,
  constructionQuote,
  formatPurchaseCost,
  projectedOrderBudget,
} from "../../game";
import type {
  CenterType,
  GameState,
  SecretOrder,
} from "../../game";
import ShipIcon from "./ShipIcon";

type Construction = Extract<SecretOrder, { kind: "construct" }>["construction"];

export default function BuildPanel({
  game,
  habitatId,
  draft,
  setDraft,
  selectHabitat,
  flash,
}: {
  game: GameState;
  habitatId: string | null;
  draft: SecretOrder[];
  setDraft: Dispatch<SetStateAction<SecretOrder[]>>;
  selectHabitat: () => void;
  flash: (message: string) => void;
}) {
  const player = game.players[game.active];
  const habitat = habitatId ? game.hexes.find((hex) => hex.id === habitatId) : undefined;
  const existing = habitatId
    ? draft.find((order) => order.kind === "construct" && order.habitatId === habitatId)
    : undefined;

  function candidate(construction: Construction) {
    if (!habitatId) return { ok: false, reason: "Select a Habitat." };
    const nextOrder: SecretOrder = {
      id: `build-${habitatId}`,
      kind: "construct",
      habitatId,
      construction,
    };
    const nextDraft = [
      ...draft.filter((order) => order.kind !== "construct" || order.habitatId !== habitatId),
      nextOrder,
    ];
    const budget = projectedOrderBudget(game, player.id, nextDraft);
    return { ok: !budget.error, reason: budget.error, nextOrder, nextDraft };
  }

  function add(construction: Construction) {
    const result = candidate(construction);
    if (!result.ok || !result.nextDraft) {
      flash(result.reason || "That construction is unavailable.");
      return;
    }
    setDraft(result.nextDraft);
    flash(`Construction Order drafted for ${habitatId}.`);
  }

  if (!habitat?.tier || habitat.owner !== player.id)
    return <div className="build-console empty-build">
      <span>MAP-DRIVEN CONSTRUCTION</span>
      <h3>Select a Habitat</h3>
      <p>Choose Build, then select one of the highlighted controlled Habitats on the map.</p>
      <button className="primary wide" onClick={selectHabitat}>Highlight build locations</button>
    </div>;

  const centers = ["material", "currency", "research", "influence", "labor", "defense"] as CenterType[];
  const constructions: Array<{ group: string; construction: Construction; detail: string; ship?: Parameters<typeof ShipIcon>[0]["type"] }> = [
    { group: "Infrastructure", construction: { type: "module" }, detail: "Loads one reusable Colony Ship with a Habitat Module." },
    { group: "Infrastructure", construction: { type: "upgrade" }, detail: "Increase this Habitat's tier and Center capacity." },
    ...centers.map((center) => ({
      group: "Centers",
      construction: { type: "center" as const, center },
      detail: center === "defense" ? "Adds permanent defensive strength." : `Produces 1 ${center} each Turn.`,
    })),
    ...[1, 2, 3].map((pairs) => ({
      group: "Forces",
      construction: { type: "recruit" as const, pairs },
      detail: `${pairs * 2} CU become available here next Turn.`,
    })),
    ...availableCarrierTypes(player).map((carrier) => ({
      group: "Military Vessels",
      construction: { type: "carrier" as const, carrier },
      detail: `Move ${carrierLibrary[carrier].move} · Capacity ${carrierLibrary[carrier].capacity}. ${carrierLibrary[carrier].special}`,
      ship: carrier as Parameters<typeof ShipIcon>[0]["type"],
    })),
  ];
  const civilian = availableCivilianType(game, player.id);
  if (civilian)
    constructions.push({
      group: "Faction Vessel",
      construction: { type: "civilian", civilian },
      detail: civilianLibrary[civilian].special,
      ship: civilian,
    });

  const groups = [...new Set(constructions.map((item) => item.group))];

  return <div className="build-console">
    <div className="purchase-header">
      <span>CONSTRUCTION ORDER</span>
      <h3>{habitat.id} · {habitat.tier}</h3>
      <button onClick={selectHabitat}>Change Habitat</button>
    </div>
    <div className="habitat-capacity">
      <span>Center slots</span>
      <b>{habitat.centers.length}/{habitat.tier === "Outpost" ? 1 : habitat.tier === "Colony" ? 2 : 3}</b>
      <span>Draft</span>
      <b>{existing ? "Order assigned" : "Available"}</b>
    </div>
    {groups.map((group) => <section className="purchase-group" key={group}>
      <h4>{group}</h4>
      <div className="purchase-list">
        {constructions.filter((item) => item.group === group).map((item, index) => {
          const quote = constructionQuote(game, player.id, habitat.id, item.construction);
          const availability = candidate(item.construction);
          const disabled = !quote.available || !availability.ok;
          return <button
            key={`${group}-${index}`}
            disabled={disabled}
            onClick={() => add(item.construction)}
            title={disabled ? availability.reason || quote.reason : `Draft ${quote.label}`}
          >
            {item.ship && <ShipIcon type={item.ship} color={player.color} title={quote.label}/>} 
            <span><b>{quote.label}</b><small>{item.detail}</small></span>
            <strong>{formatPurchaseCost(quote.cost)}</strong>
            {disabled && <em>{quote.reason || availability.reason}</em>}
          </button>;
        })}
      </div>
    </section>)}
  </div>;
}
