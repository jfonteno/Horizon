"use client";

import type { Dispatch, SetStateAction } from "react";
import { activeAgreements, carrierLibrary, hexDistance, legalBombardmentTargets, mobileHabitatLibrary } from "../../game";
import type { GameState, SecretOrder, TradableResource } from "../../game";

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
type DraftOrder = WithoutId<SecretOrder>;

export default function ShatteredReachPanel({ game, draft, setDraft }: {
  game: GameState;
  draft: SecretOrder[];
  setDraft: Dispatch<SetStateAction<SecretOrder[]>>;
}) {
  const player = game.players[game.active];
  if (!["spires", "aegis", "wayfarers", "salvo", "guilds"].includes(player.faction)) return null;
  const add = (order: DraftOrder) => setDraft((current) => [...current, { ...order, id: `reach-${globalThis.crypto.randomUUID()}` } as SecretOrder]);

  const mobileOptions = game.mobileHabitats.filter((mobile) => mobile.owner === player.id && mobile.readyTurn <= game.turn && mobile.movesRemaining > 0);
  const artillery = game.carriers.filter((carrier) => carrier.owner === player.id && (carrierLibrary[carrier.type].bombard || 0) > 0 && carrier.readyTurn <= game.turn);
  const factories = game.hexes.flatMap((hex) => hex.owner === player.id ? hex.centers.map((center, index) => ({ hex, center, index })).filter((entry) => entry.center === "factory") : []);
  const transferable = game.blockades.filter((blockade) => blockade.owner === player.id && blockade.active);
  const partners = [...new Set(activeAgreements(game).filter((agreement) => agreement.parties.includes(player.id)).flatMap((agreement) => agreement.parties).filter((id) => id !== player.id))];

  return <section className="reach-orders">
    <h4>Shattered Reach abilities</h4>
    {player.faction === "spires" && <p>Arcologies and Spires Defense Grids are issued from Build. Urban objectives update automatically.</p>}
    {player.faction === "wayfarers" && <>
      <p>Migration validates the destination first, then packs, moves, and redeploys atomically.</p>
      {mobileOptions.map((mobile) => {
        const targets = game.hexes.filter((hex) => hex.revealed && hex.kind !== "rift" && hexDistance(mobile.hex, hex.id) === 1);
        return <div className="reach-order-row" key={mobile.id}><span><b>{mobileHabitatLibrary[mobile.type].name}</b><small>{mobile.hex}</small></span>{targets.map((target) => <button key={target.id} disabled={draft.some((order) => order.kind === "migration" && order.mobileHabitatId === mobile.id)} onClick={() => add({ kind: "migration", mobileHabitatId: mobile.id, destination: target.id })}>Migrate to {target.id}</button>)}</div>;
      })}
      {player.tech.Exploration >= 2 && player.explorationVessels.map((vessel) => {
        const targets = game.hexes.filter((hex) => !hex.revealed && hexDistance(vessel.hex, hex.id) === 1);
        return targets.length ? <div className="reach-order-row" key={`recon-${vessel.id}`}><span><b>Deep Recon</b><small>{vessel.hex}</small></span>{targets.map((target) => <button key={target.id} disabled={player.deepReconUsedTurn === game.turn || draft.some((order) => order.kind === "wayfarerDeepRecon")} onClick={() => add({ kind: "wayfarerDeepRecon", vesselId: vessel.id, hexId: target.id })}>Scan {target.id}</button>)}</div> : null;
      })}
    </>}
    {player.faction === "salvo" && <>
      <p>Choose any hex in range from the vessel on the map. Bombardment 1 may follow its movement, while Bombardment 2 requires it to hold position. Fire resolves after fleet movement and only damages hostile CUs present then.</p>
      {artillery.map((carrier) => {
        const move = draft.find((order): order is Extract<SecretOrder, { kind: "carrierMove" }> => order.kind === "carrierMove" && order.carrierIds.includes(carrier.id));
        const targets = legalBombardmentTargets(game, player.id, carrier.id, undefined, move?.destination);
        return <div className="reach-order-row bombard-preview" key={carrier.id}><span><b>{carrierLibrary[carrier.type].name}</b><small>{move?.destination || carrier.hex} · Select any in-range hex on the map</small></span>{targets.some((target) => target.tenderId) && <mark>Supported by Siege Tender: range available once this Turn</mark>}{targets.filter((target) => target.targetPlayerId !== undefined).map((target) => <button key={target.hexId} disabled={draft.some((order) => order.kind === "bombard" && order.carrierId === carrier.id)} onClick={() => add({ kind: "bombard", carrierId: carrier.id, targetHexId: target.hexId, targetPlayerId: target.targetPlayerId, strength: move ? 1 : carrierLibrary[carrier.type].bombard as 1 | 2 })}>Bombard occupied hex {target.hexId}</button>)}</div>;
      })}
    </>}
    {player.faction === "guilds" && <>
      <p>Factory output is locked when Orders resolve and applies to the following Production.</p>
      {factories.map(({ hex, index }) => <div className="reach-order-row" key={`${hex.id}-${index}`}><span><b>Factory</b><small>{hex.id}</small></span>{(["material", "currency", "research"] as TradableResource[]).map((output) => <button key={output} onClick={() => add({ kind: "factoryOutput", habitatId: hex.id, factoryIndex: index, output })}>{output}</button>)}</div>)}
    </>}
    {player.faction === "aegis" && <>
      <p>Defense Grids follow Habitat ownership. Select a military vessel on the map to load or deploy a Blockade. At Economy II, open Diplomacy to sell one and let the buyer choose its destination.</p>
      {transferable.map((blockade) => <div className="reach-order-row" key={blockade.id}><span><b>Blockade</b><small>{blockade.hex}</small></span>{partners.map((partner) => <button key={partner} onClick={() => add({ kind: "transferBlockade", blockadeId: blockade.id, toPlayerId: partner })}>Gift to {game.players[partner].name}</button>)}{!partners.length && <small>Establish an agreement to gift or sell this platform.</small>}</div>)}
    </>}
  </section>;
}
