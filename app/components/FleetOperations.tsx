"use client";

import {
  availableCarrierTypes,
  buildCarrier,
  carrierCost,
  carrierLibrary,
  constructionAvailable,
  formatCost,
  recruitCombatUnits,
  taskForceSummary,
  totalCombatUnits,
  transferCombatUnit,
  evaluateLegacy,
} from "../../game";
import type { GameState, HexState } from "../../game";
import ShipIcon from "./ShipIcon";

type SharedProps = {
  game: GameState;
  commit: (game: GameState) => void;
  flash: (message: string) => void;
};

function run(game: GameState, commit: (game: GameState) => void, flash: (message: string) => void, action: (draft: GameState) => { ok: boolean; message: string }) {
  const draft = structuredClone(game);
  const result = action(draft);
  if (result.ok) evaluateLegacy(draft);
  flash(result.message);
  if (result.ok) commit(draft);
}

export function FleetCommandPanel({ game, commit, flash }: SharedProps) {
  const player = game.players[game.active];
  const carriers = game.carriers.filter(carrier => carrier.owner === player.id);
  const here = carriers.filter(carrier => carrier.hex === game.selected);
  const selected = carriers.filter(carrier => game.selectedCarrierIds.includes(carrier.id));
  const summary = taskForceSummary(game, game.selectedCarrierIds);

  function toggle(id: string) {
    const draft = structuredClone(game);
    const carrier = draft.carriers.find(item => item.id === id)!;
    const current = draft.carriers.filter(item => draft.selectedCarrierIds.includes(item.id));
    if (draft.selectedCarrierIds.includes(id)) draft.selectedCarrierIds = draft.selectedCarrierIds.filter(item => item !== id);
    else if (current.length && current[0].hex !== carrier.hex) draft.selectedCarrierIds = [id];
    else draft.selectedCarrierIds.push(id);
    draft.selected = carrier.hex;
    commit(draft);
  }

  function selectAllHere() {
    const draft = structuredClone(game);
    draft.selectedCarrierIds = here.filter(carrier => carrier.readyTurn <= game.turn && carrier.cu > 0).map(carrier => carrier.id);
    commit(draft);
  }

  function transfer(direction: "load" | "unload") {
    if (selected.length !== 1) { flash("Select exactly one carrier for CU transfer."); return; }
    run(game, commit, flash, draft => transferCombatUnit(draft, player.id, selected[0].id, direction));
  }

  return <>
    <h3>Fleet Operations</h3>
    <p>Select one or more carriers in the same hex to form a task force, then click an adjacent revealed hex. Each CU contributes 1 CS.</p>
    <div className="task-force-readout"><span>Selected task force</span><strong>{summary.carriers} carriers · {summary.cu} CS · {summary.movement} move</strong></div>
    <div className="fleet-list">{carriers.map(carrier => {
      const definition = carrierLibrary[carrier.type], chosen = game.selectedCarrierIds.includes(carrier.id);
      return <button key={carrier.id} className={chosen ? "selected" : ""} onClick={() => toggle(carrier.id)}><ShipIcon type={carrier.type} color={player.color} title={definition.name}/><span><b>{definition.name}</b><small>{carrier.hex} · {carrier.readyTurn > game.turn ? `Ready Turn ${carrier.readyTurn}` : carrier.cu ? `${carrier.movesRemaining} move` : "Uncrewed"}</small></span><strong>{carrier.cu}/{definition.capacity}<small> CU</small></strong></button>;
    })}</div>
    {!carriers.length && <p className="muted">No operational military carriers.</p>}
    <div className="fleet-actions"><button onClick={selectAllHere} disabled={!here.length}>Select all at {game.selected}</button><button onClick={() => transfer("load")}>Load 1 CU</button><button onClick={() => transfer("unload")}>Station 1 CU</button></div>
    <div className="unit-readout"><span>Fleet CU <b>{totalCombatUnits(game, player.id)}</b></span><span>At selected hex <b>{here.length} carrier{here.length === 1 ? "" : "s"}</b></span><span>Stationed CU <b>{game.hexes.find(hex => hex.id === game.selected)?.combat || 0}</b></span></div>
  </>;
}

export function FleetConstructionPanel({ game, commit, flash, habitat }: SharedProps & { habitat?: HexState }) {
  const player = game.players[game.active];
  if (!habitat?.tier || habitat.owner !== player.id) return <><h3>Habitat Construction</h3><p>Select one of your Habitats to issue its Construction Order.</p></>;
  const habitatId = habitat.id;
  const available = constructionAvailable(habitat, game.turn);

  function construct(type: Parameters<typeof buildCarrier>[3]) {
    run(game, commit, flash, draft => buildCarrier(draft, player.id, habitatId, type));
  }

  function recruit(pairs: number) {
    run(game, commit, flash, draft => recruitCombatUnits(draft, player.id, habitatId, pairs));
  }

  return <>
    <h3>Construction at {habitatId}</h3>
    <p className={available ? "construction-ready" : "construction-spent"}>{available ? "Construction Order available" : "Construction Order used this Turn"}</p>
    <div className="recruit-grid"><span>Recruit Combat Units</span>{[1, 2, 3].map(pairs => <button key={pairs} disabled={!available} onClick={() => recruit(pairs)}>{pairs * 2} CU <small>{pairs}C · {pairs}L</small></button>)}</div>
    <h4 className="subhead">Military vessels</h4>
    <div className="vessel-build-list">{availableCarrierTypes(player).map(type => {
      const definition = carrierLibrary[type];
      return <button key={type} disabled={!available} onClick={() => construct(type)}><ShipIcon type={type} color={player.color} title={definition.name}/><span><b>{definition.name}</b><small>Move {definition.move} · Capacity {definition.capacity}</small></span><strong>{formatCost(carrierCost(player, type))}</strong><em>{definition.special}</em></button>;
    })}</div>
    <p className="rule-note">New vessels and recruited CU become available next Turn. A new military vessel automatically loads 1 stationed CU when it activates. An uncrewed vessel cannot operate.</p>
  </>;
}
