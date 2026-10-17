import { getNeighbors } from "../engine/geometry";
import { factionRules } from "../factions";
import { mapLibrary } from "../maps";
import type { GameState, HexState, MobileHabitatState, MobileHabitatType, Resource, SecretOrder } from "../types";
import { activeAgreements, hasAgreement, hexDistance } from "./diplomacy";
import { canPay, centerCosts, spend } from "./economy";
import { carrierLibrary, carrierMovement } from "./fleet";
import { blockadeConstructionCost, resolveBlockadeCargoOrder } from "./blockades";
import type { PurchaseCost } from "./purchases";
import { activePolicy, markPolicyUsed, policyCost } from "./policy-deck";

export const mobileHabitatLibrary: Record<MobileHabitatType, { name: string; tech: number; slots: number; tier: "Colony" | "Metropolis"; cost: PurchaseCost }> = {
  arkship: { name: "Arkship", tech: 2, slots: 2, tier: "Colony", cost: { material: 3, currency: 2, labor: 2 } },
  grandArk: { name: "Grand Ark", tech: 3, slots: 3, tier: "Metropolis", cost: { material: 5, currency: 3, labor: 3 } },
  worldship: { name: "Worldship", tech: 4, slots: 4, tier: "Metropolis", cost: { material: 7, currency: 5, labor: 4, influence: 1 } },
};

const mobileExtractionResources: Resource[] = ["material", "currency", "research", "influence"];

export function mobileHabitatExtractionResource(game: GameState, mobile: MobileHabitatState): Resource | null {
  if (!mobile.deployed || factionRules(game.players[mobile.owner]) !== "wayfarers") return null;
  const world = game.hexes.find((hex) => hex.id === mobile.hex);
  return world && mobileExtractionResources.includes(world.kind as Resource) ? world.kind as Resource : null;
}

export function habitatSlots(tier: HexState["tier"]) {
  return tier === "Arcology" ? 4 : tier === "Metropolis" ? 3 : tier === "Colony" ? 2 : tier === "Outpost" ? 1 : 0;
}

export function homeGuardStrength(game: GameState, habitat: HexState) {
  if (habitat.owner === undefined) return 0;
  const owner = game.players[habitat.owner];
  const profile = factionRules(owner);
  const hasGrid = habitat.centers.includes("defense");
  if (habitat.defenseGridOrigin === "spires" && hasGrid) return owner.tech.Military >= 4 ? 5 : owner.tech.Military >= 2 ? 4 : 3;
  if (profile === "aegis" || habitat.defenseGridOrigin === "aegis") {
    const base = habitat.kind === "home" ? 3 : habitat.tier === "Arcology" || habitat.tier === "Metropolis" ? 4 : habitat.tier === "Colony" ? 3 : 2;
    return base + (hasGrid ? 2 : 0);
  }
  if (profile === "salvo" && hasGrid) return 2;
  return hasGrid ? 3 : 1;
}

export function shatteredConstructionCost(game: GameState, playerId: number, habitatId: string, construction: Extract<SecretOrder, { kind: "construct" }>["construction"]): { label: string; cost: PurchaseCost; available: boolean; reason?: string } | null {
  const player = game.players[playerId];
  const habitat = game.hexes.find((hex) => hex.id === habitatId);
  const unavailable = (label: string, cost: PurchaseCost, reason: string) => ({ label, cost, available: false, reason });
  if (construction.type === "mobileCenter" || construction.type === "caravanGuard") {
    const mobile = game.mobileHabitats.find((candidate) => candidate.id === construction.mobileHabitatId && candidate.owner === playerId && candidate.hex === habitatId && candidate.deployed);
    const cost = construction.type === "mobileCenter" ? policyCost(game, playerId, "center", centerCosts[construction.center]) : { currency: 1, labor: 1 };
    const label = construction.type === "mobileCenter" ? `${construction.center[0].toUpperCase()}${construction.center.slice(1)} Mobile Center` : "Caravan Guard";
    if (factionRules(player) !== "wayfarers" || !mobile) return unavailable(label, cost, "Choose a deployed Wayfarer mobile Habitat.");
    if (mobile.constructionUsedTurn === game.turn) return unavailable(label, cost, "That mobile Habitat already constructed this Turn.");
    if (construction.type === "mobileCenter" && mobile.centers.length >= mobileHabitatLibrary[mobile.type].slots) return unavailable(label, cost, "That mobile Habitat has no open Center slots.");
    if (construction.type === "caravanGuard") {
      const cap = mobile.type === "worldship" ? 3 : mobile.type === "grandArk" ? 2 : 1;
      if (mobile.caravanGuards >= cap) return unavailable(label, cost, "That mobile Habitat is at its Caravan Guard limit.");
    }
    return { label, cost, available: true };
  }
  if (!habitat?.tier || habitat.owner !== playerId) return null;
  if (construction.type === "arcology") {
    const cost = { material: 4, currency: 3, labor: 3 };
    if (factionRules(player) !== "spires") return unavailable("Habitat Upgrade: Arcology", cost, "Only the Spires can construct an Arcology.");
    if (player.tech.Resource < 3 || (habitat.tier !== "Colony" && habitat.tier !== "Metropolis")) return unavailable("Habitat Upgrade: Arcology", cost, "Requires Resource III and a Colony.");
    return { label: "Habitat Upgrade: Arcology", cost, available: true };
  }
  if (construction.type === "enhanceCenter") {
    const cost = { material: 3, currency: 3, research: 2 };
    const center = habitat.centers[construction.centerIndex];
    if (factionRules(player) !== "guilds") return unavailable("Enhanced Center", cost, "Only the Guilds can enhance Centers.");
    if (!center || ["labor", "defense", "factory"].includes(center)) return unavailable("Enhanced Center", cost, "Choose an eligible economic Center.");
    if (habitat.enhancedCenterIndices?.includes(construction.centerIndex)) return unavailable("Enhanced Center", cost, "That Center is already Enhanced.");
    const cap = player.tech.Resource >= 4 ? 3 : player.tech.Resource >= 3 ? 2 : 1;
    if ((habitat.enhancedCenterIndices?.length || 0) >= cap) return unavailable("Enhanced Center", cost, `This Habitat supports ${cap} Enhanced Center${cap === 1 ? "" : "s"} at the current Resource level.`);
    if (player.laborCap <= 1) return unavailable("Enhanced Center", cost, "Permanent Labor Capacity cannot fall below 1.");
    return { label: `Enhanced ${center[0].toUpperCase()}${center.slice(1)} Center`, cost, available: true };
  }
  if (construction.type === "factory") {
    const cost = policyCost(game, playerId, "center", { material: 3, currency: 3, labor: 2 });
    if (factionRules(player) !== "guilds" || player.tech.Economy < 3) return unavailable("Factory", cost, "Requires the Guilds and Economy III.");
    if (habitat.centers.length + (habitat.portalDestinations?.length || 0) >= habitatSlots(habitat.tier)) return unavailable("Factory", cost, "No open Center slots.");
    return { label: "Factory", cost, available: true };
  }
  if (construction.type === "mobileHabitat") {
    const definition = mobileHabitatLibrary[construction.vessel];
    if (factionRules(player) !== "wayfarers") return unavailable(definition.name, definition.cost, "Only the Wayfarers construct mobile Habitats.");
    if (player.tech.Resource < definition.tech) return unavailable(definition.name, definition.cost, `Requires Resource ${definition.tech}.`);
    if (construction.vessel === "worldship" && game.mobileHabitats.some((mobile) => mobile.owner === playerId && mobile.type === "worldship")) return unavailable(definition.name, definition.cost, "Only one Worldship may be controlled.");
    return { label: definition.name, cost: definition.cost, available: true };
  }
  if (construction.type === "blockade") {
    const cost = blockadeConstructionCost;
    if (factionRules(player) !== "aegis" || player.tech.Military < 2) return unavailable("Blockade Platform", cost, "Requires the Aegis and Military II.");
    if (game.blockades.some((blockade) => blockade.hex === habitatId && blockade.active)) return unavailable("Blockade Platform", cost, "Only one active Blockade may occupy a hex.");
    return { label: "Blockade Platform", cost, available: true };
  }
  return null;
}

export function resolveShatteredConstruction(game: GameState, playerId: number, habitatId: string, construction: Extract<SecretOrder, { kind: "construct" }>["construction"]) {
  const quote = shatteredConstructionCost(game, playerId, habitatId, construction);
  if (!quote?.available) return false;
  const player = game.players[playerId];
  const habitat = game.hexes.find((hex) => hex.id === habitatId);
  const mobileConstruction = construction.type === "mobileCenter" || construction.type === "caravanGuard";
  const mobile = mobileConstruction ? game.mobileHabitats.find((candidate) => candidate.id === construction.mobileHabitatId && candidate.owner === playerId) : undefined;
  if (!canPay(player, quote.cost) || (mobileConstruction ? mobile?.constructionUsedTurn === game.turn : habitat?.constructionUsedTurn === game.turn)) return false;
  if (mobileConstruction) mobile!.constructionUsedTurn = game.turn;
  else habitat!.constructionUsedTurn = game.turn;
  spend(player, quote.cost);
  if (construction.type === "arcology") {
    habitat!.tier = "Arcology";
    habitat!.arcologyOrigin = "spires";
  } else if (construction.type === "enhanceCenter") {
    habitat!.enhancedCenterIndices = [...(habitat!.enhancedCenterIndices || []), construction.centerIndex];
    player.laborPenalty = (player.laborPenalty || 0) + 1;
    player.laborCap = Math.max(1, player.laborCap - 1);
    player.labor = Math.min(player.labor, player.laborCap);
  } else if (construction.type === "factory") {
    habitat!.centers.push("factory");
    habitat!.factoryOutputs ||= {};
    habitat!.factoryOutputs[habitat!.centers.length - 1] = "material";
    if (activePolicy(game) === "infrastructure-grants") markPolicyUsed(game, playerId, "center");
  } else if (construction.type === "mobileHabitat") {
    const sequence = game.mobileHabitats.filter((mobile) => mobile.owner === playerId).length + 1;
    game.mobileHabitats.push({ id: `mobile-${playerId}-${sequence}`, owner: playerId, type: construction.vessel, hex: habitatId, centers: [], caravanGuards: 0, readyTurn: game.turn + 1, movesRemaining: 0, deployed: true });
  } else if (construction.type === "mobileCenter") {
    mobile!.centers.push(construction.center);
    if (activePolicy(game) === "infrastructure-grants") markPolicyUsed(game, playerId, "center");
  } else if (construction.type === "blockade") {
    game.blockades.push({ id: `blockade-${playerId}-${game.blockades.length + 1}`, owner: playerId, hex: habitatId, active: true, readyTurn: game.turn + 1, originFaction: "aegis" });
  } else if (construction.type === "caravanGuard") {
    mobile!.caravanGuards++;
  }
  player.legacyMetrics.habitatDevelopmentHexes[game.era - 1].push(habitatId);
  game.log.unshift(`${player.name} completed ${quote.label} at ${habitatId}.`);
  return true;
}

type BombardmentTarget = {
  owner: number;
  kind: "carrier" | "stationed";
  id: string;
  cu: number;
  capacity: number;
  movement: number;
};

function bombardmentCandidates(game: GameState, salvoPlayerId: number, hexId: string): BombardmentTarget[] {
  const hostile = (owner: number) => owner !== salvoPlayerId &&
    !hasAgreement(game, salvoPlayerId, owner, "alliance") &&
    !hasAgreement(game, salvoPlayerId, owner, "nonAggression");
  const candidates: BombardmentTarget[] = game.carriers
    .filter((carrier) => carrier.hex === hexId && carrier.cu > 0 && hostile(carrier.owner))
    .map((carrier) => ({
      owner: carrier.owner,
      kind: "carrier" as const,
      id: carrier.id,
      cu: carrier.cu,
      capacity: carrierLibrary[carrier.type].capacity,
      movement: carrierLibrary[carrier.type].move,
    }));
  const habitat = game.hexes.find((hex) => hex.id === hexId && hex.owner !== undefined && hostile(hex.owner));
  if (habitat?.owner !== undefined && habitat.combat > 0) candidates.push({
    owner: habitat.owner,
    kind: "stationed",
    id: `stationed:${hexId}`,
    cu: habitat.combat,
    capacity: 0,
    movement: 0,
  });
  return candidates.filter((candidate) => {
    const total = game.carriers.filter((carrier) => carrier.hex === hexId && carrier.owner === candidate.owner).reduce((sum, carrier) => sum + carrier.cu, 0) +
      (game.hexes.find((hex) => hex.id === hexId && hex.owner === candidate.owner)?.combat || 0);
    return total > 1;
  }).sort((a, b) => a.cu - b.cu || a.capacity - b.capacity || a.movement - b.movement || a.owner - b.owner || a.id.localeCompare(b.id));
}

export function bombardmentTargetPlayer(game: GameState, salvoPlayerId: number, hexId: string) {
  return bombardmentCandidates(game, salvoPlayerId, hexId)[0]?.owner;
}

function supportingSiegeTender(game: GameState, playerId: number, carrierHex: string, targetHex: string, usedTenderIds = new Set<string>()) {
  return game.carriers
    .filter((candidate) => candidate.owner === playerId && candidate.type === "siegeTender" && !usedTenderIds.has(candidate.id) &&
      (candidate.hex === carrierHex || getNeighbors(carrierHex, mapLibrary[game.mapId]).includes(candidate.hex)))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function legalBombardmentTargets(game: GameState, playerId: number, carrierId: string, usedTenderIds = new Set<string>(), firingHex?: string) {
  const carrier = game.carriers.find((candidate) => candidate.id === carrierId && candidate.owner === playerId);
  if (factionRules(game.players[playerId]) !== "salvo" || !carrier || !(carrierLibrary[carrier.type].bombard || 0) || carrier.readyTurn > game.turn) return [];
  const origin = firingHex || carrier.hex;
  return game.hexes.flatMap((hex) => {
    if (hex.kind === "rift") return [];
    const targetPlayerId = bombardmentTargetPlayer(game, playerId, hex.id);
    const range = hexDistance(origin, hex.id);
    const level = game.players[playerId].tech.Military;
    const baseRange = level >= 4 ? 7 : level >= 3 ? 4 : level >= 2 ? 2 : 1;
    if (range > 4) {
      const spotterHexes = [hex.id, ...getNeighbors(hex.id, mapLibrary[game.mapId])];
      const spotted = game.carriers.some((candidate) => candidate.owner === playerId && candidate.id !== carrier.id && spotterHexes.includes(candidate.hex)) ||
        game.players[playerId].explorationVessels.some((vessel) => spotterHexes.includes(vessel.hex)) ||
        game.mobileHabitats.some((mobile) => mobile.owner === playerId && spotterHexes.includes(mobile.hex));
      if (!spotted) return [];
    }
    const tender = range === baseRange + 1 ? supportingSiegeTender(game, playerId, origin, hex.id, usedTenderIds) : undefined;
    if (range < 1 || (range > baseRange && !tender)) return [];
    return [{ hexId: hex.id, targetPlayerId, range, tenderId: tender?.id }];
  });
}

function damageTarget(game: GameState, salvoPlayerId: number, hexId: string, amount: number) {
  let dealt = 0;
  const affectedOwners = new Map<number, number>();
  while (dealt < amount) {
    const target = bombardmentCandidates(game, salvoPlayerId, hexId)[0];
    if (!target) break;
    if (target.kind === "stationed") {
      const habitat = game.hexes.find((hex) => hex.id === hexId && hex.owner === target.owner)!;
      habitat.combat--;
    } else {
      const carrier = game.carriers.find((candidate) => candidate.id === target.id)!;
      carrier.cu--;
    }
    affectedOwners.set(target.owner, (affectedOwners.get(target.owner) || 0) + 1);
    dealt++;
  }
  return { dealt, affectedOwners };
}

export function resolveShatteredOrders(game: GameState, entries: Array<{ playerId: number; order: SecretOrder }>) {
  const usedSiegeTenders = new Set<string>();
  for (const { playerId, order } of entries) {
    const player = game.players[playerId];
    if (order.kind === "migration") {
      const mobile = game.mobileHabitats.find((candidate) => candidate.id === order.mobileHabitatId && candidate.owner === playerId);
      const target = game.hexes.find((hex) => hex.id === order.destination);
      if (!mobile || mobile.readyTurn > game.turn || mobile.movesRemaining < 1 || !target?.revealed || target.kind === "rift" || !getNeighbors(mobile.hex, mapLibrary[game.mapId]).includes(target.id)) continue;
      const origin = mobile.hex;
      mobile.deployed = false;
      mobile.hex = target.id;
      mobile.movesRemaining--;
      mobile.deployed = true;
      player.legacyMetrics.wayfarerMigrationHexes.push(target.id);
      if (mobile.type === "arkship") (player.legacyMetrics.wayfarerArkshipHexes ||= []).push(target.id);
      if (mobile.centers.length) player.legacyMetrics.wayfarerRelocatedCenters += mobile.centers.length;
      game.log.unshift(`${player.name}'s ${mobileHabitatLibrary[mobile.type].name} migrated from ${origin} to ${target.id}.`);
    }
    if (order.kind === "wayfarerDeepRecon") {
      const vessel = player.explorationVessels.find((candidate) => candidate.id === (order.vesselId || player.explorationVessels[0]?.id));
      const target = game.hexes.find((hex) => hex.id === order.hexId);
      if (factionRules(player) !== "wayfarers" || player.tech.Exploration < 2 || player.deepReconUsedTurn === game.turn || !vessel || !target || target.revealed || !getNeighbors(vessel.hex, mapLibrary[game.mapId]).includes(target.id)) continue;
      player.privateSurveys.push({ hexId: target.id, kind: target.kind, surveyedTurn: game.turn, soldTo: [] });
      player.legacyMetrics.wayfarerDeepScans.push(target.id);
      player.deepReconUsedTurn = game.turn;
      game.log.unshift(`${player.name} completed a private Deep Recon scan.`);
    }
    if (order.kind === "factoryOutput") {
      const habitat = game.hexes.find((hex) => hex.id === order.habitatId && hex.owner === playerId);
      if (factionRules(player) === "guilds" && habitat?.centers[order.factoryIndex] === "factory") {
        habitat.factoryOutputs ||= {};
        habitat.factoryOutputs[order.factoryIndex] = order.output;
      }
    }
    if (order.kind === "blockadeCargo") resolveBlockadeCargoOrder(game, playerId, order);
    if (order.kind === "transferBlockade") {
      const blockade = game.blockades.find((candidate) => candidate.id === order.blockadeId && candidate.owner === playerId && candidate.active && !candidate.carrierId);
      const agreement = activeAgreements(game).some((candidate) => candidate.parties.includes(playerId) && candidate.parties.includes(order.toPlayerId));
      if (!blockade || !agreement || game.carriers.some((carrier) => carrier.hex === blockade.hex && carrier.owner !== playerId && carrier.owner !== order.toPlayerId)) continue;
      blockade.owner = order.toPlayerId;
      player.legacyMetrics.aegisPlatformTransfers.push(order.toPlayerId);
      game.players[order.toPlayerId].legacyMetrics.aegisForeignBeneficiaries.push(playerId);
      game.log.unshift(`${player.name} transferred a Blockade Platform to ${game.players[order.toPlayerId].name}.`);
    }
  }
  for (const { playerId, order } of entries) {
    if (order.kind !== "bombard") continue;
    const player = game.players[playerId];
    const carrier = game.carriers.find((candidate) => candidate.id === order.carrierId && candidate.owner === playerId);
    const bombard = carrier?.type === "bombardFrigate" ? 1 : carrier?.type === "siegeCruiser" ? 2 : 0;
    if (factionRules(player) !== "salvo" || !carrier || !bombard || carrier.readyTurn > game.turn) continue;
    const legalTarget = legalBombardmentTargets(game, playerId, carrier.id, usedSiegeTenders).find((target) => target.hexId === order.targetHexId);
    if (!legalTarget) continue;
    const prior = game.bombardmentDamage[order.targetHexId] || 0;
    if (prior >= 2) {
      game.log.unshift(`${player.name}'s Bombardment of ${order.targetHexId} had no effect: that hex already took the maximum damage this Turn.`);
      continue;
    }
    const shots = game.bombardmentsThisTurn[playerId] || 0;
    if (shots > 0 && player.resources.material < 1) continue;
    if (shots > 0) player.resources.material--;
    const requestedStrength = Math.min(order.strength || bombard, bombard) as 1 | 2;
    if (requestedStrength === 2 && carrier.movesRemaining < carrierMovement(game, carrier)) {
      game.log.unshift(`${player.name}'s Bombardment 2 order was cancelled because the vessel moved.`);
      continue;
    }
    const damage = Math.min(requestedStrength, 2 - prior);
    const { dealt, affectedOwners } = damageTarget(game, playerId, order.targetHexId, damage);
    if (legalTarget.tenderId) usedSiegeTenders.add(legalTarget.tenderId);
    game.bombardmentsThisTurn[playerId] = shots + 1;
    if (!dealt) {
      game.log.unshift(`${player.name} bombarded ${order.targetHexId}, but no hostile CU was hit.`);
      continue;
    }
    game.bombardmentDamage[order.targetHexId] = prior + dealt;
    player.legacyMetrics.salvoBombardments++;
    player.legacyMetrics.salvoBombardKills += dealt;
    if (!player.legacyMetrics.salvoBombardTurns.includes(game.turn)) player.legacyMetrics.salvoBombardTurns.push(game.turn);
    for (const [affectedPlayerId, affectedDamage] of affectedOwners) {
      if (!player.legacyMetrics.salvoBombardTargets.includes(affectedPlayerId)) player.legacyMetrics.salvoBombardTargets.push(affectedPlayerId);
      game.bombardmentMarks.push({ turn: game.turn, salvoPlayerId: playerId, targetPlayerId: affectedPlayerId, hexId: order.targetHexId, damage: affectedDamage });
    }
    game.log.unshift(`${player.name} bombarded ${order.targetHexId} for ${dealt} CU loss.`);
  }
}

export function recordGunForHire(game: GameState, hexId: string, defeatedOwners: number[], winnerOwners: number[]) {
  for (const mark of game.bombardmentMarks.filter((candidate) => candidate.turn === game.turn && candidate.hexId === hexId && defeatedOwners.includes(candidate.targetPlayerId))) {
    if (!winnerOwners.some((winner) => winner !== mark.salvoPlayerId && winner !== mark.targetPlayerId)) continue;
    const salvo = game.players[mark.salvoPlayerId];
    salvo.legacyMetrics.salvoGunForHireEvents++;
    if (!salvo.legacyMetrics.salvoGunForHireTargets.includes(mark.targetPlayerId)) salvo.legacyMetrics.salvoGunForHireTargets.push(mark.targetPlayerId);
    game.log.unshift(`${salvo.name} completed a Gun for Hire fire-support occasion at ${hexId}.`);
  }
  game.bombardmentMarks = game.bombardmentMarks.filter((mark) => !(mark.turn === game.turn && mark.hexId === hexId && defeatedOwners.includes(mark.targetPlayerId)));
}

export function beginShatteredTurn(game: GameState, playerId: number) {
  for (const mobile of game.mobileHabitats.filter((candidate) => candidate.owner === playerId)) mobile.movesRemaining = mobile.readyTurn <= game.turn ? 1 : 0;
  if (playerId === 0) {
    game.bombardmentDamage = {};
    game.bombardmentsThisTurn = {};
    game.bombardmentMarks = game.bombardmentMarks.filter((mark) => mark.turn >= game.turn);
  }
}

export function produceShattered(game: GameState, playerId: number) {
  const player = game.players[playerId];
  for (const habitat of game.hexes.filter((hex) => hex.owner === playerId)) {
    for (const index of habitat.enhancedCenterIndices || []) {
      const center = habitat.centers[index];
      if (center && ["material", "currency", "research", "influence"].includes(center)) player.resources[center as Resource]++;
    }
    habitat.centers.forEach((center, index) => {
      if (center !== "factory") return;
      const output = habitat.factoryOutputs?.[index] || "material";
      player.resources[output] += player.tech.Resource >= 4 ? 2 : 1;
    });
  }
  for (const mobile of game.mobileHabitats.filter((candidate) => candidate.owner === playerId && candidate.deployed)) {
    let produced = false;
    const extractionResource = mobileHabitatExtractionResource(game, mobile);
    if (extractionResource) {
      player.resources[extractionResource]++;
      produced = true;
    }
    for (const center of mobile.centers) if (["material", "currency", "research", "influence"].includes(center)) {
      player.resources[center as Resource] += player.tech.Resource >= 4 ? 2 : 1;
      produced = true;
    }
    if (produced && !player.legacyMetrics.wayfarerProductionHexes.includes(mobile.hex)) player.legacyMetrics.wayfarerProductionHexes.push(mobile.hex);
  }
}
