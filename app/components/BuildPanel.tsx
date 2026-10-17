"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  availableCarrierTypes,
  availableCivilianType,
  availableExplorationTypes,
  carrierLibrary,
  civilianLibrary,
  explorationLibrary,
  colonyShipDefinition,
  constructionQuote,
  factionLibrary,
  formatPurchaseCost,
  projectedOrderBudget,
  orderLabel,
} from "../../game";
import type {
  CenterType,
  GameState,
  SecretOrder,
} from "../../game";
import ShipIcon from "./ShipIcon";
import { ResourceGlyph, type DisplayResource } from "./network/ResourceGlyph";

type Construction = Extract<SecretOrder, { kind: "construct" }>["construction"];
type BuildItem = {
  group: string;
  construction: Construction;
  detail: string;
  targetId?: string;
  ship?: Parameters<typeof ShipIcon>[0]["type"];
};

const centerResources = ["material", "currency", "research", "influence", "labor"] as const;
function buildCategory(item: BuildItem): string {
  const type = item.construction.type;
  if (type === "center" || type === "mobileCenter" || type === "replaceCenter") return item.construction.center;
  if (type === "carrier" || type === "blockade" || type === "caravanGuard" || type === "recruit") return "military";
  if (type === "colony" || type === "civilian" || type === "exploration" || type === "mobileHabitat") return "civilian";
  return "infrastructure";
}
function BuildGlyph({ item, color }: { item: BuildItem; color: string }) {
  if (item.ship) return <ShipIcon type={item.ship} color={color} title="Vessel"/>;
  const category = buildCategory(item);
  if (centerResources.some((resource) => resource === category)) return <span className="build-glyph"><ResourceGlyph resource={category as DisplayResource} label={false}/></span>;
  const paths: Record<string, string> = {
    military: "M12 2 20 6v6c0 5-4 8-8 10-4-2-8-5-8-10V6zM8 13l8 5M16 13l-8 5",
    civilian: "M3 13l9-9 9 9-9 7zM7 13h10M12 4v16",
    infrastructure: "M4 20V7l8-4 8 4v13zM8 10h8M8 14h8M8 18h8",
    defense: "M12 2 20 6v8l-8 8-8-8V6zM12 7v10M8 12h8",
    factory: "M3 21V9l6 4V9l6 4V4h6v17z",
  };
  return <span className="build-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d={paths[category] || paths.infrastructure}/></svg></span>;
}

const factionCarrierTypes = {
  aegis: ["blockadeTender"],
  wayfarers: ["gunneryPlatform"],
  salvo: ["bombardFrigate", "siegeCruiser", "siegeTender"],
} as const;

const factionBuildNotes: Partial<Record<string, string>> = {
  spires: "Concentrate development with discounted Habitat upgrades, Spires Defense Grids, and Arcologies built from Colonies at Resource III.",
  aegis: "Your first economic Center costs 1 less Currency. At Economy II, commission a new Blockade through Diplomacy: the buyer pays its build cost plus your fee and chooses a controlled hex. At Military II, build Blockades and the Blockade Deployment Vessel for your own defense. Load or deploy Blockades from any military vessel; the specialist carries 3.",
  wayfarers: "Construct mobile Habitats and Gunnery Platforms here. Mobile Centers and Caravan Guards are installed directly aboard any deployed mobile Habitat.",
  salvo: "Construct Bombard Frigates, Siege Cruisers, and the Siege Tender here. Select an artillery vessel on the map to issue Bombardment.",
  guilds: "Enhance economic Centers and construct Factories here. Factory output can be changed below without spending a construction opportunity.",
};

export default function BuildPanel({
  game,
  habitatId,
  draft,
  setDraft,
  selectHabitat,
  openDiplomacy,
  flash,
}: {
  game: GameState;
  habitatId: string | null;
  draft: SecretOrder[];
  setDraft: Dispatch<SetStateAction<SecretOrder[]>>;
  selectHabitat: () => void;
  openDiplomacy?: () => void;
  flash: (message: string) => void;
}) {
  const player = game.players[game.active];
  const habitat = habitatId ? game.hexes.find((hex) => hex.id === habitatId) : undefined;
  const existing = habitatId
    ? draft.find((order) => order.kind === "construct" && order.habitatId === habitatId)
    : undefined;

  function candidate(construction: Construction, targetId = habitatId) {
    if (!targetId) return { ok: false, reason: "Select a Habitat." };
    const nextOrder: SecretOrder = {
      id: `build-${targetId}-${globalThis.crypto.randomUUID()}`,
      kind: "construct",
      habitatId: targetId,
      construction,
    };
    const nextDraft = [
      ...draft,
      nextOrder,
    ];
    const budget = projectedOrderBudget(game, player.id, nextDraft);
    return { ok: !budget.error, reason: budget.error, nextOrder, nextDraft };
  }

  function add(item: BuildItem) {
    const targetId = item.targetId || habitatId;
    const result = candidate(item.construction, targetId);
    if (!result.ok || !result.nextDraft) {
      flash(result.reason || "That construction is unavailable.");
      return;
    }
    setDraft(result.nextDraft);
    flash(`${constructionQuote(game, player.id, targetId!, item.construction).label} added at ${targetId}.`);
  }

  function setFactoryOutput(factoryHabitatId: string, factoryIndex: number, output: "material" | "currency" | "research") {
    const order: SecretOrder = {
      id: `factory-${factoryHabitatId}-${factoryIndex}-${globalThis.crypto.randomUUID()}`,
      kind: "factoryOutput",
      habitatId: factoryHabitatId,
      factoryIndex,
      output,
    };
    setDraft((current) => [
      ...current.filter((entry) => entry.kind !== "factoryOutput" || entry.habitatId !== factoryHabitatId || entry.factoryIndex !== factoryIndex),
      order,
    ]);
    flash(`Factory at ${factoryHabitatId} will produce ${output}.`);
  }

  if (!habitat?.tier || habitat.owner !== player.id)
    return <div className="build-console empty-build">
      <span>MAP-DRIVEN CONSTRUCTION</span>
      <h3>Select a Habitat</h3>
      <p>Choose Build, then select one of the highlighted controlled Habitats on the map.</p>
      <button className="primary wide" onClick={selectHabitat}>Highlight build locations</button>
    </div>;

  const factionName = factionLibrary[player.faction].name;
  const factionGroup = `${factionName} Construction`;
  const factionConstructions: BuildItem[] = [];
  const standardConstructions: BuildItem[] = [];
  const centers = ["material", "currency", "research", "influence", "labor"] as CenterType[];
  for (const centerIndex of habitat.centers.keys()) {
    standardConstructions.push({ group: "Center Operations", construction: { type: "removeCenter", centerIndex }, detail: `Remove ${habitat.centers[centerIndex]} as this Habitat's construction action. No refund.` });
    for (const center of centers.filter((candidate) => candidate !== habitat.centers[centerIndex])) standardConstructions.push({ group: "Center Operations", construction: { type: "replaceCenter", centerIndex, center }, detail: `Replace ${habitat.centers[centerIndex]} with ${center} in one construction action.` });
  }

  if (player.faction === "spires") {
    factionConstructions.push(
      { group: factionGroup, construction: { type: "center", center: "defense" }, detail: "Spires Defense Grid. Its defensive strength scales at Military II and Military IV." },
      { group: factionGroup, construction: { type: "arcology" }, detail: "Resource III Habitat Upgrade. Converts a Colony into a four-slot Spires Arcology." },
    );
  }
  if (player.faction === "aegis") {
    factionConstructions.push(
      { group: factionGroup, construction: { type: "center", center: "defense" }, detail: "Aegis Defense Grid. Adds +2 CS to this Habitat's reinforced Home Guard." },
      { group: factionGroup, construction: { type: "blockade" }, detail: "Military II platform. It begins deployed here with 4 defensive CS and can be loaded onto a military vessel next Turn." },
    );
  }
  const factionCarriers = factionCarrierTypes[player.faction as keyof typeof factionCarrierTypes] || [];
  factionCarriers.forEach((carrier) => factionConstructions.push({
    group: factionGroup,
    construction: { type: "carrier", carrier },
    detail: `Military ${carrierLibrary[carrier].tech}. Move ${carrierLibrary[carrier].move} · Capacity ${carrierLibrary[carrier].capacity}. ${carrierLibrary[carrier].special}`,
    ship: carrier,
  }));
  if (player.faction === "wayfarers") {
    (["arkship", "grandArk", "worldship"] as const).forEach((vessel) => factionConstructions.push({
      group: factionGroup,
      construction: { type: "mobileHabitat", vessel },
      detail: "A mobile Habitat with Move 1 and atomic Migration Orders.",
    }));
    game.mobileHabitats.filter((mobile) => mobile.owner === player.id).forEach((mobile) => {
      factionConstructions.push({
        group: factionGroup,
        construction: { type: "caravanGuard", mobileHabitatId: mobile.id },
        targetId: mobile.hex,
        detail: `Install aboard ${mobile.id} at ${mobile.hex}. Adds 3 defensive CS and migrates with it.`,
      });
      (["material", "currency", "research", "influence", "labor"] as const).forEach((center) => factionConstructions.push({
        group: factionGroup,
        construction: { type: "mobileCenter", mobileHabitatId: mobile.id, center },
        targetId: mobile.hex,
        detail: `Install aboard ${mobile.id} at ${mobile.hex}. This Center migrates with the vessel.`,
      }));
    });
  }
  if (player.faction === "guilds") {
    factionConstructions.push({ group: factionGroup, construction: { type: "factory" }, detail: "Economy III Center. Produces your selected Material, Currency, or Research output." });
    habitat.centers.forEach((center, centerIndex) => {
      if (!["labor", "defense", "factory"].includes(center)) factionConstructions.push({
        group: factionGroup,
        construction: { type: "enhanceCenter", centerIndex },
        detail: `Enhance this ${center} Center. It produces +1 and permanently reduces Labor Capacity by 1.`,
      });
    });
  }

  standardConstructions.push(
    { group: "Infrastructure", construction: { type: "module" }, detail: "Adds one Habitat Module to your shared stock. Each Establish Order consumes one Module." },
    { group: "Infrastructure", construction: { type: "upgrade" }, detail: "Increase this Habitat's tier and Center capacity." },
    { group: "Civilian Vessels", construction: { type: "colony" }, detail: `${colonyShipDefinition.special} Move ${colonyShipDefinition.move}. Ready next Turn; Habitat Module sold separately.`, ship: "colonyShip" },
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
    ...(player.faction === "spires" || player.faction === "aegis" ? [] : [{
      group: "Centers",
      construction: { type: "center" as const, center: "defense" as const },
      detail: "Adds permanent defensive strength.",
    }]),
    ...availableCarrierTypes(player).filter((carrier) => !carrierLibrary[carrier].faction).map((carrier) => ({
      group: "Military Vessels",
      construction: { type: "carrier" as const, carrier },
      detail: `Move ${carrierLibrary[carrier].move + (player.tech.Military >= 4 ? 4 : player.tech.Military >= 3 ? 2 : player.tech.Military >= 2 ? 1 : 0)} at your current Military level · Capacity ${carrierLibrary[carrier].capacity}. ${carrierLibrary[carrier].special}`,
      ship: carrier as Parameters<typeof ShipIcon>[0]["type"],
    })),
    ...availableExplorationTypes(game, player.id).map((vessel) => ({
      group: "Exploration Vessels",
      construction: { type: "exploration" as const, vessel },
      detail: `Move ${explorationLibrary[vessel].move + Math.max(0, player.tech.Exploration - explorationLibrary[vessel].tech)}. Reveal up to ${player.tech.Exploration} unknown hexes per Turn.`,
    })),
  );
  const civilian = availableCivilianType(game, player.id);
  if (civilian)
    standardConstructions.push({
      group: "Faction Vessel",
      construction: { type: "civilian", civilian },
      detail: civilianLibrary[civilian].special,
      ship: civilian,
    });

  const constructions = [...factionConstructions, ...standardConstructions];
  const grouped = [...new Set(constructions.map((item) => item.group))];
  const factories = player.faction === "guilds"
    ? game.hexes.flatMap((hex) => hex.owner === player.id ? hex.centers.flatMap((center, index) => center === "factory" ? [{ hex, index }] : []) : [])
    : [];
  const ownedBlockades = player.faction === "aegis" ? game.blockades.filter((blockade) => blockade.owner === player.id && (blockade.active || blockade.carrierId) && blockade.readyTurn <= game.turn) : [];

  return <div className="build-console">
    <div className="purchase-header">
      <span>CONSTRUCTION ORDER</span>
      <h3>{habitat.id} · {habitat.tier}</h3>
      <button onClick={selectHabitat}>Change Habitat</button>
    </div>
    <div className="habitat-capacity">
      <span>Center slots</span>
      <b>{habitat.centers.length + (habitat.portalDestinations?.length || 0)}/{habitat.tier === "Arcology" ? 4 : habitat.tier === "Outpost" ? 1 : habitat.tier === "Colony" ? 2 : 3}</b>
      <div className="habitat-slot-list" aria-label="Current Center slots">
        {Array.from({ length: habitat.tier === "Arcology" ? 4 : habitat.tier === "Outpost" ? 1 : habitat.tier === "Colony" ? 2 : 3 }, (_, index) => {
          const center = habitat.centers[index];
          const portal = !center ? habitat.portalDestinations?.[index - habitat.centers.length] : undefined;
          return <div key={index} className={`habitat-slot ${center ? `resource-${center}` : portal ? "portal" : "empty"}`}>
            <i>{center && centerResources.some((resource) => resource === center) ? <ResourceGlyph resource={center as DisplayResource} label={false}/> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={center === "defense" ? "M12 2 20 6v8l-8 8-8-8V6z" : center === "factory" ? "M3 21V9l6 4V9l6 4V4h6v17z" : portal ? "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" : "M5 12h14"}/></svg>}</i>
            <span>Slot {index + 1}</span><b>{center || (portal ? `Portal to ${portal}` : "Empty")}</b>
          </div>;
        })}
      </div>
      <span>Draft</span>
      <b>{existing ? "Order assigned" : "Available"}</b>
    </div>
    {factionBuildNotes[player.faction] && <section className="faction-build-summary">
      <span>FACTION TOOLKIT</span>
      <b>{factionName}</b>
      <p>{factionBuildNotes[player.faction]}</p>
    </section>}
    {habitat.kind === "home" && habitat.originalOwner === player.id && player.tech.Exploration >= 4 && <section className="faction-build-operations">
      <h4>Exploration IV Portals</h4>
      <p>Consume an Exploration vessel to connect this Homeworld to its current hex. Each portal permanently occupies a Center slot. A vessel may travel through an owned portal as one movement step.</p>
      {(habitat.portalDestinations || []).map((id) => <div key={id}><span><b>Portal to {id}</b><small>Occupies one Homeworld slot</small></span></div>)}
      {player.explorationVessels.filter((vessel) => vessel.readyTurn <= game.turn && vessel.hex !== habitat.id && game.hexes.some((hex) => hex.id === vessel.hex && hex.revealed && hex.kind !== "rift") && !(habitat.portalDestinations || []).includes(vessel.hex)).map((vessel) => {
        const full = habitat.centers.length + (habitat.portalDestinations?.length || 0) >= (habitat.tier === "Arcology" ? 4 : habitat.tier === "Metropolis" ? 3 : habitat.tier === "Colony" ? 2 : 1);
        const choices = full ? habitat.centers.map((center, index) => ({ label: `Replace ${center} Center`, index })) : [{ label: "Use empty slot", index: undefined }];
        return <div key={vessel.id}><span><b>{vessel.type} at {vessel.hex}</b><small>Consumed when the portal opens</small></span>{choices.map(({ label, index }) => <button key={label} onClick={() => setDraft((current) => [...current.filter((order) => !(order.kind === "openPortal" && order.vesselId === vessel.id)), { id: `portal-${vessel.id}`, kind: "openPortal", vesselId: vessel.id, replaceCenterIndex: index }])}>{label}</button>)}</div>;
      })}
    </section>}
    {factories.length > 0 && <section className="faction-build-operations">
      <h4>Factory Operations</h4>
      {factories.map(({ hex, index }) => {
        const draftedOutput = draft.find((entry): entry is Extract<SecretOrder, { kind: "factoryOutput" }> => entry.kind === "factoryOutput" && entry.habitatId === hex.id && entry.factoryIndex === index);
        const selected = draftedOutput?.output || hex.factoryOutputs?.[index] || "material";
        return <div key={`${hex.id}-${index}`}><span><b>Factory at {hex.id}</b><small>Output: {selected}</small></span>{(["material", "currency", "research"] as const).map((output) => <button key={output} className={selected === output ? "selected" : ""} onClick={() => setFactoryOutput(hex.id, index, output)}>{output}</button>)}</div>;
      })}
    </section>}
    {ownedBlockades.length > 0 && <section className="faction-build-operations">
      <h4>Blockade Operations</h4>
      {ownedBlockades.map((blockade) => <div key={blockade.id}><span><b>Blockade {blockade.active ? `at ${blockade.hex}` : `aboard ${blockade.carrierId}`}</b><small>{blockade.active ? "Deployed · 4 defensive CS" : "Loaded · inactive while carried"}</small></span><button disabled={player.tech.Economy < 2} title={player.tech.Economy < 2 ? "Security Export requires Economy II." : undefined} onClick={openDiplomacy}>Sell in Diplomacy</button></div>)}
    </section>}
    {player.faction === "aegis" && <section className="faction-build-operations">
      <h4>Security Export</h4>
      <div><span><b>Commission a new Blockade</b><small>At Economy II, the buyer pays its build cost plus your fee. No Blockade inventory is required.</small></span><button disabled={player.tech.Economy < 2 || !openDiplomacy} onClick={openDiplomacy}>Open Diplomacy</button></div>
    </section>}
    <p>Queue as many builds as your resources and Labor allow. Upgrades and Centers are checked in queue order.</p>
    <div aria-live="polite">{draft.filter((order) => order.kind === "construct" && (order.habitatId === habitatId || (order.construction.type === "mobileCenter" || order.construction.type === "caravanGuard"))).map((order) => <div className="build-queued-item" key={order.id}><b>{orderLabel(order)}</b><button onClick={() => setDraft((current) => current.filter((entry) => entry.id !== order.id))}>Remove</button></div>)}</div>
    {grouped.map((group) => <section className={`purchase-group ${group === "Military Vessels" || group === "Forces" ? "group-military" : group === "Civilian Vessels" || group === "Exploration Vessels" || group === "Faction Vessel" ? "group-civilian" : group === "Centers" ? "group-centers" : "group-other"}`} key={group}>
      <h4>{group}</h4>
      <div className="purchase-list">
        {constructions.filter((item) => item.group === group).map((item, index) => {
          const targetId = item.targetId || habitat.id;
          const quote = constructionQuote(game, player.id, targetId, item.construction);
          const availability = candidate(item.construction, targetId);
          const disabled = !availability.ok;
          const count = draft.filter((order) => order.kind === "construct" && order.habitatId === targetId && JSON.stringify(order.construction) === JSON.stringify(item.construction)).length;
          return <button
            key={`${group}-${index}`}
            className={`build-item build-${buildCategory(item)} ${count ? "build-selected" : ""}`}
            disabled={disabled}
            onClick={() => add(item)}
            title={disabled ? availability.reason || quote.reason : `Draft ${quote.label}`}
          >
            <BuildGlyph item={item} color={player.color}/>
            <span><b>{quote.label}{count > 0 ? ` (${count} queued)` : ""}</b><small>{item.detail}</small></span>
            <strong>{formatPurchaseCost(quote.cost)}</strong>
            {disabled && <em>{quote.reason || availability.reason}</em>}
          </button>;
        })}
      </div>
    </section>)}
  </div>;
}
