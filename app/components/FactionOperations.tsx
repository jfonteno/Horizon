"use client";

import { useState } from "react";
import {
  availableCivilianType,
  brokerTrade,
  buildCivilian,
  civilianLibrary,
  economicSalvage,
  evaluateLegacy,
  forwardScan,
  longRangeSurvey,
  moveCivilian,
  prospect,
  surveyExchange,
} from "../../game";
import type { GameState, Resource, TradeBundle } from "../../game";
import ShipIcon from "./ShipIcon";

const zero = (): TradeBundle => ({
  material: 0,
  currency: 0,
  research: 0,
  labor: 0,
});
export default function FactionOperations({
  game,
  commit,
  flash,
  negotiationOnly = false,
}: {
  game: GameState;
  commit: (game: GameState) => void;
  flash: (s: string) => void;
  negotiationOnly?: boolean;
}) {
  const p = game.players[game.active],
    units = game.civilianUnits.filter((u) => u.owner === p.id),
    available = availableCivilianType(game, p.id),
    rivals = game.players.filter((x) => x.id !== p.id);
  const [selectedUnit, setSelectedUnit] = useState(units[0]?.id || ""),
    [buyer, setBuyer] = useState(rivals[0]?.id || 0),
    [surveyHex, setSurveyHex] = useState(
      p.privateSurveys.find(
        (s) => !game.hexes.find((h) => h.id === s.hexId)?.revealed,
      )?.hexId || "",
    ),
    [price, setPrice] = useState(1);
  const nonMeridian = game.players.filter((x) => x.id !== p.id),
    [partyA, setPartyA] = useState(nonMeridian[0]?.id || 0),
    [partyB, setPartyB] = useState(nonMeridian[1]?.id || 0),
    [aResource, setAResource] = useState<Resource>("material"),
    [bResource, setBResource] = useState<Resource>("currency"),
    [aAmount, setAAmount] = useState(1),
    [bAmount, setBAmount] = useState(1);
  const unit = units.find((u) => u.id === selectedUnit) || units[0],
    selectedHex = game.hexes.find((h) => h.id === game.selected);
  function run(
    action: (g: GameState) => {
      ok: boolean;
      message: string;
      privateDetail?: string;
    },
  ) {
    const d = structuredClone(game),
      result = action(d);
    flash(result.privateDetail || result.message);
    if (result.ok) {
      evaluateLegacy(d);
      commit(d);
    }
  }
  function build() {
    if (!available) return;
    run((g) => buildCivilian(g, p.id, g.selected, available));
  }
  function broker() {
    const a = zero(),
      b = zero();
    a[aResource] = aAmount;
    b[bResource] = bAmount;
    run((g) => brokerTrade(g, p.id, partyA, partyB, a, b));
  }
  const unsold = p.privateSurveys.filter(
    (s) => !game.hexes.find((h) => h.id === s.hexId)?.revealed,
  );
  return (
    <>
      <h3>Faction Operations</h3>
      <p>
        {p.faction === "foundry"
          ? "Prospect revealed unclaimed worlds for Material."
          : p.faction === "aurelians"
            ? "Deploy Envoys and convert diplomatic Influence."
            : p.faction === "meridian"
              ? "Broker trades between other civilizations and salvage military assets."
              : p.faction === "farbound"
                ? "Privately survey the Reach, settle efficiently, and sell verified intelligence."
                : "Your primary faction systems operate automatically."}
      </p>
      {available && !negotiationOnly && (
        <div className="faction-unit-build">
          <ShipIcon type={available} color={p.color} title={civilianLibrary[available].name} />
          <b>{civilianLibrary[available].name}</b>
          <small>{civilianLibrary[available].special}</small>
          <button onClick={build}>Build at selected Habitat</button>
        </div>
      )}
      {units.length > 0 && (
        <>
          <h4 className="subhead">Faction vessels</h4>
          <div className="fleet-list">
            {units.map((u) => (
              <button
                key={u.id}
                className={unit?.id === u.id ? "selected" : ""}
                onClick={() => setSelectedUnit(u.id)}
              >
                <ShipIcon type={u.type} color={p.color} title={civilianLibrary[u.type].name} />
                <span>
                  <b>{civilianLibrary[u.type].name}</b>
                  <small>
                    {u.hex} ·{" "}
                    {u.readyTurn > game.turn
                      ? `Ready Turn ${u.readyTurn}`
                      : `${u.movesRemaining} move`}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!negotiationOnly && <div className="fleet-actions">
            <button
              onClick={() =>
                unit && run((g) => moveCivilian(g, p.id, unit.id, g.selected))
              }
            >
              Move to selected hex
            </button>
            {unit?.type === "prospector" && (
              <button onClick={() => run((g) => prospect(g, p.id, unit.id))}>
                Prospect current hex
              </button>
            )}
            {unit?.type === "surveyor" && (
              <button
                onClick={() =>
                  run((g) => longRangeSurvey(g, p.id, unit.id, g.selected))
                }
              >
                Survey selected hex
              </button>
            )}
          </div>}
        </>
      )}
      {p.faction === "farbound" && (
        <>
          {!negotiationOnly && <button
            className="wide faction-button"
            onClick={() => run((g) => forwardScan(g, p.id, g.selected))}
          >
            Forward scan selected adjacent hex
          </button>}
          <div className="private-intel">
            <h4>Private survey archive</h4>
            {p.privateSurveys.length ? (
              p.privateSurveys.map((s) => (
                <span key={s.hexId}>
                  <b>{s.hexId}</b> {s.kind}
                  {game.hexes.find((h) => h.id === s.hexId)?.revealed
                    ? " · now public"
                    : ""}
                </span>
              ))
            ) : (
              <small>No private surveys recorded.</small>
            )}
          </div>
          {unsold.length > 0 && (
            <div className="survey-sale">
              <h4>Survey Exchange</h4>
              <select
                value={surveyHex}
                onChange={(e) => setSurveyHex(e.target.value)}
              >
                {unsold.map((s) => (
                  <option key={s.hexId} value={s.hexId}>
                    {s.hexId}
                  </option>
                ))}
              </select>
              <select
                value={buyer}
                onChange={(e) => setBuyer(Number(e.target.value))}
              >
                {rivals.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Survey price"
                type="number"
                min="0"
                value={price}
                onChange={(e) =>
                  setPrice(Math.max(0, Number(e.target.value) || 0))
                }
              />
              <button
                onClick={() =>
                  run((g) => surveyExchange(g, p.id, buyer, surveyHex, price))
                }
              >
                Confirm agreed sale
              </button>
            </div>
          )}
        </>
      )}
      {p.faction === "meridian" && (
        <>
          <div className="broker-console">
            <h4>Brokerage</h4>
            <label>
              First party
              <select
                value={partyA}
                onChange={(e) => setPartyA(Number(e.target.value))}
              >
                {nonMeridian.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gives
              <select
                value={aResource}
                onChange={(e) => setAResource(e.target.value as Resource)}
              >
                {["material", "currency", "research"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                value={aAmount}
                onChange={(e) =>
                  setAAmount(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </label>
            <label>
              Second party
              <select
                value={partyB}
                onChange={(e) => setPartyB(Number(e.target.value))}
              >
                {nonMeridian.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gives
              <select
                value={bResource}
                onChange={(e) => setBResource(e.target.value as Resource)}
              >
                {["material", "currency", "research"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                value={bAmount}
                onChange={(e) =>
                  setBAmount(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </label>
            <button onClick={broker}>Confirm brokered trade</button>
          </div>
          <button
            className="wide faction-button"
            onClick={() => run((g) => economicSalvage(g, p.id))}
          >
            Economic Salvage: 4 CU to 1 Currency
          </button>
        </>
      )}
      {p.faction === "aurelians" && (
        <div className="unit-readout">
          <span>
            Envoy hosts <b>{p.legacyMetrics.envoyHosts.length}</b>
          </span>
          <span>
            Diplomatic Influence gained{" "}
            <b>{p.diplomacy.bonusInfluenceGained || 0}</b>
          </span>
        </div>
      )}
      {selectedHex?.surveyedBy?.includes(p.id) && (
        <p className="surveyed-note">Selected hex is in your Survey Network.</p>
      )}
    </>
  );
}
