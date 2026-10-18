import { getNeighbors } from "../engine/geometry";
import { factionRules } from "../factions";
import { factionLibrary } from "../factions";
import { mapLibrary } from "../maps";
import type { CarrierState, CarrierType, GameState, HexState, PlayerState } from "../types";
import { hasAgreement, hasBenefit, hasStationingPermission } from "./diplomacy";
import { canPay, spend } from "./economy";
import { homeGuardStrength, recordGunForHire } from "./shattered-reach";
import { destroyLoadedBlockades, syncLoadedBlockades } from "./blockades";
import { portalNeighbors, removeCenterAt } from "./portals";
import { activePolicy, markPolicyUsed, policyCost, policyUsed } from "./policy-deck";

export type CarrierDefinition = {
  type: CarrierType;
  name: string;
  tech: number;
  move: number;
  capacity: number;
  cost: Record<string, number>;
  faction?: "varkesh" | "aegis" | "wayfarers" | "salvo";
  intrinsicCS?: number;
  bombard?: number;
  special: string;
};

export const carrierLibrary: Record<CarrierType, CarrierDefinition> = {
  patrol: { type: "patrol", name: "Patrol Vessel", tech: 1, move: 2, capacity: 2, cost: { material: 1, currency: 1, labor: 1 }, special: "Basic fast patrol." },
  transport: { type: "transport", name: "Transport", tech: 1, move: 1, capacity: 6, cost: { material: 2, currency: 2, labor: 1 }, special: "High early capacity." },
  frigate: { type: "frigate", name: "Frigate", tech: 2, move: 2, capacity: 4, cost: { material: 2, currency: 2, labor: 1 }, special: "Improved general fleet platform." },
  assault: { type: "assault", name: "Assault Vessel", tech: 2, move: 2, capacity: 5, cost: { material: 3, currency: 2, labor: 2 }, special: "Reduces defending Home Guard by 1 CS." },
  cruiser: { type: "cruiser", name: "Cruiser", tech: 3, move: 2, capacity: 6, cost: { material: 4, currency: 3, labor: 2 }, special: "Advanced fleet platform." },
  heavyTransport: { type: "heavyTransport", name: "Heavy Transport", tech: 3, move: 2, capacity: 10, cost: { material: 5, currency: 4, labor: 2 }, special: "Large troop transport." },
  battleship: { type: "battleship", name: "Battleship", tech: 4, move: 3, capacity: 8, cost: { material: 6, currency: 5, labor: 3 }, special: "Fast high-tier platform." },
  fleetTransport: { type: "fleetTransport", name: "Fleet Transport", tech: 4, move: 2, capacity: 14, cost: { material: 7, currency: 5, labor: 3 }, special: "Maximum standard capacity." },
  corvette: { type: "corvette", name: "Corvette", tech: 2, move: 3, capacity: 2, cost: { material: 1, currency: 1, labor: 1 }, faction: "varkesh", special: "Varkesh rapid-response vessel." },
  xebec: { type: "xebec", name: "Xebec", tech: 4, move: 3, capacity: 12, cost: { material: 7, currency: 6, labor: 3 }, faction: "varkesh", special: "Varkesh rapid force projection." },
  blockadeTender: { type: "blockadeTender", name: "Blockade Deployment Vessel", tech: 2, move: 2, capacity: 2, cost: { material: 3, currency: 3, labor: 2 }, faction: "aegis", special: "Carries up to 3 Blockades. Other military vessels carry 1." },
  bombardFrigate: { type: "bombardFrigate", name: "Bombard Frigate", tech: 2, move: 3, capacity: 2, cost: { material: 3, currency: 3, labor: 2 }, faction: "salvo", bombard: 1, special: "Bombardment 1. Movement 3 allows rapid deployment to a firing position." },
  siegeCruiser: { type: "siegeCruiser", name: "Siege Cruiser", tech: 3, move: 1, capacity: 3, cost: { material: 5, currency: 4, labor: 2 }, faction: "salvo", bombard: 2, special: "Bombardment 2 when stationary." },
  siegeTender: { type: "siegeTender", name: "Siege Tender", tech: 4, move: 1, capacity: 2, intrinsicCS: 5, cost: { material: 5, currency: 4, labor: 2 }, faction: "salvo", special: "5 CS. Once per Turn extends one supported Bombardment by 1 hex." },
  gunneryPlatform: { type: "gunneryPlatform", name: "Gunnery Platform", tech: 3, move: 2, capacity: 2, intrinsicCS: 4, cost: { material: 4, currency: 3, labor: 2 }, faction: "wayfarers", special: "4 CS, rising to 6 CS while defending a Wayfarer mobile Habitat." },
};

export function militaryMovementBonus(level: number) {
  return level >= 4 ? 4 : level >= 3 ? 2 : level >= 2 ? 1 : 0;
}

export function carrierMovement(game: GameState, carrier: CarrierState) {
  return carrierLibrary[carrier.type].move + militaryMovementBonus(game.players[carrier.owner].tech.Military);
}

const standardTypes: CarrierType[] = ["patrol", "transport", "frigate", "assault", "cruiser", "heavyTransport", "battleship", "fleetTransport"];

export function carrierCost(player: PlayerState, type: CarrierType): Record<string, number> {
  const definition = carrierLibrary[type];
  const cost = { ...definition.cost };
  if (factionRules(player) === "varkesh" && !definition.faction) cost.material = Math.max(1, (cost.material || 0) - 1);
  return cost;
}

export function availableCarrierTypes(player: PlayerState): CarrierType[] {
  const available = standardTypes.filter(type => carrierLibrary[type].tech <= player.tech.Military);
  if (factionRules(player) === "varkesh" && player.tech.Military >= 2) available.push("corvette");
  if (factionRules(player) === "varkesh" && player.tech.Military >= 4) available.push("xebec");
  if (factionRules(player) === "aegis" && player.tech.Military >= 2) available.push("blockadeTender");
  if (factionRules(player) === "wayfarers" && player.tech.Military >= 3) available.push("gunneryPlatform");
  if (factionRules(player) === "salvo" && player.tech.Military >= 2) available.push("bombardFrigate");
  if (factionRules(player) === "salvo" && player.tech.Military >= 3) available.push("siegeCruiser");
  if (factionRules(player) === "salvo" && player.tech.Military >= 4) available.push("siegeTender");
  return available;
}

export function constructionAvailable(hex: HexState, turn: number): boolean {
  return !!hex.tier && turn > 0;
}

function claimConstruction(hex: HexState, turn: number): boolean {
  if (!constructionAvailable(hex, turn)) return false;
  hex.constructionUsedTurn = turn;
  return true;
}

function uniqueCarrierId(game: GameState, owner: number): string {
  let sequence = game.carriers.length + 1;
  while (game.carriers.some(carrier => carrier.id === `carrier-${owner}-${sequence}`)) sequence++;
  return `carrier-${owner}-${sequence}`;
}

export function buildCarrier(game: GameState, playerId: number, habitatId: string, type: CarrierType): { ok: boolean; message: string } {
  const player = game.players[playerId], habitat = game.hexes.find(hex => hex.id === habitatId);
  if (!habitat?.tier || habitat.owner !== playerId) return { ok: false, message: "Select one of your Habitats." };
  if (!availableCarrierTypes(player).includes(type)) return { ok: false, message: "Your Military Technology does not unlock that vessel." };
  if (!constructionAvailable(habitat, game.turn)) return { ok: false, message: "That Habitat already used its Construction Order this Turn." };
  const cost = policyCost(game, playerId, "carrier", carrierCost(player, type));
  if (!canPay(player, cost)) return { ok: false, message: "You cannot afford that vessel." };
  claimConstruction(habitat, game.turn);
  spend(player, cost);
  if (activePolicy(game) === "arms-expansion") markPolicyUsed(game, playerId, "carrier");
  game.carriers.push({ id: uniqueCarrierId(game, playerId), owner: playerId, type, hex: habitatId, cu: 0, readyTurn: game.turn + 1, movesRemaining: 0 });
  player.legacyMetrics.builtVessels[game.era - 1]++;
  game.log.unshift(`${player.name} began construction of a ${carrierLibrary[type].name} at ${habitatId}. It becomes available next Turn and must be crewed with at least 1 CU.`);
  return { ok: true, message: `${carrierLibrary[type].name} constructed for next Turn.` };
}

export function recruitCombatUnits(game: GameState, playerId: number, habitatId: string, pairs: number): { ok: boolean; message: string } {
  const player = game.players[playerId], habitat = game.hexes.find(hex => hex.id === habitatId);
  if (!habitat?.tier || habitat.owner !== playerId) return { ok: false, message: "Select one of your Habitats." };
  if (!Number.isInteger(pairs) || pairs < 1) return { ok: false, message: "Recruit at least one pair of Combat Units." };
  if (!constructionAvailable(habitat, game.turn)) return { ok: false, message: "That Habitat already used its Construction Order this Turn." };
  const cost = policyCost(game, playerId, "recruit", { currency: pairs, labor: pairs });
  if (!canPay(player, cost)) return { ok: false, message: "You cannot afford that recruitment order." };
  claimConstruction(habitat, game.turn);
  spend(player, cost);
  habitat.pendingCombat ||= [];
  const amount = pairs * 2 + Number(activePolicy(game) === "strategic-mobilization" && !policyUsed(game, playerId, "recruit", "turn"));
  if (amount > pairs * 2) markPolicyUsed(game, playerId, "recruit", "turn");
  habitat.pendingCombat.push({ amount, readyTurn: game.turn + 1 });
  player.legacyMetrics.recruitedCU[game.era - 1] += amount;
  game.log.unshift(`${player.name} recruited ${amount} CU at ${habitatId}; they become available next Turn.`);
  return { ok: true, message: `${amount} Combat Units recruited for next Turn.` };
}

export function claimHabitatConstruction(game: GameState, habitatId: string): boolean {
  const habitat = game.hexes.find(hex => hex.id === habitatId);
  return !!habitat && claimConstruction(habitat, game.turn);
}

export function beginFleetTurn(game: GameState, playerId: number): void {
  game.hexes.forEach(hex => {
    const arriving = (hex.pendingCombat || []).filter(force => force.readyTurn <= game.turn).reduce((sum, force) => sum + force.amount, 0);
    if (arriving) hex.combat += arriving;
    hex.pendingCombat = (hex.pendingCombat || []).filter(force => force.readyTurn > game.turn);
  });
  const playerCarriers = game.carriers.filter(carrier => carrier.owner === playerId);
  playerCarriers.forEach(carrier => {
    const definition = carrierLibrary[carrier.type];
    if (carrier.readyTurn <= game.turn && carrier.cu === 0) {
      const habitat = game.hexes.find(hex => hex.id === carrier.hex && hex.owner === playerId && hex.combat > 0);
      if (habitat) { habitat.combat--; carrier.cu = 1; }
    }
    carrier.movesRemaining = carrier.readyTurn <= game.turn && carrier.cu > 0 ? carrierMovement(game, carrier) : 0;
  });
  // Newly built hulls remain docked until the player can provide a crew.
  game.selectedCarrierIds = game.carriers.filter(carrier => carrier.owner === playerId && carrier.readyTurn <= game.turn).slice(0, 1).map(carrier => carrier.id);
}

export function transferCombatUnit(game: GameState, playerId: number, carrierId: string, direction: "load" | "unload", amount = 1): { ok: boolean; message: string } {
  const carrier = game.carriers.find(item => item.id === carrierId && item.owner === playerId);
  if (!carrier) return { ok: false, message: "Carrier not found." };
  const habitat = game.hexes.find(hex => hex.id === carrier.hex && hex.owner === playerId && hex.tier);
  if (!habitat) return { ok: false, message: "CU transfers require one of your Habitats in the carrier's hex." };
  const definition = carrierLibrary[carrier.type];
  const count = Math.max(1, Math.floor(amount));
  if (direction === "load") {
    const moved = Math.min(count, habitat.combat, definition.capacity - carrier.cu);
    if (!moved) return { ok: false, message: "No stationed CU or carrier capacity is available." };
    const wasUncrewed = carrier.cu === 0;
    habitat.combat -= moved; carrier.cu += moved;
    if (wasUncrewed && carrier.readyTurn <= game.turn) carrier.movesRemaining = carrierMovement(game, carrier);
    return { ok: true, message: `${moved} CU loaded onto ${definition.name}.` };
  }
  const moved = Math.min(count, Math.max(0, carrier.cu - 1));
  if (!moved) return { ok: false, message: "A military vessel must retain at least 1 CU." };
  carrier.cu -= moved; habitat.combat += moved;
  return { ok: true, message: `${moved} CU stationed at ${habitat.id}.` };
}

function trimCarriers(game: GameState, carriers: CarrierState[], survivors: number): void {
  const ordered = [...carriers].sort((a, b) => carrierLibrary[b.type].capacity - carrierLibrary[a.type].capacity || a.id.localeCompare(b.id));
  const kept = ordered.slice(0, Math.min(ordered.length, survivors));
  const keepIds = new Set(kept.map(carrier => carrier.id));
  destroyLoadedBlockades(game, carriers.filter((carrier) => !keepIds.has(carrier.id)).map((carrier) => carrier.id));
  game.carriers = game.carriers.filter(carrier => !carriers.some(candidate => candidate.id === carrier.id) || keepIds.has(carrier.id));
  kept.forEach(carrier => { carrier.cu = 1; });
  let extra = survivors - kept.length;
  kept.forEach(carrier => {
    const add = Math.min(extra, carrierLibrary[carrier.type].capacity - 1);
    carrier.cu += add; extra -= add;
  });
}

function defenderCasualties(game: GameState, hostileCarriers: CarrierState[], habitat: HexState | undefined, casualties: number): void {
  let remaining = casualties;
  if (habitat && habitat.combat) {
    const loss = Math.min(habitat.combat, remaining);
    habitat.combat -= loss; remaining -= loss;
  }
  if (!remaining) return;
  const totalCarrierCU = hostileCarriers.reduce((sum, carrier) => sum + carrier.cu, 0);
  trimCarriers(game, hostileCarriers, Math.max(0, totalCarrierCU - remaining));
}

function tierSlots(tier: HexState["tier"]): number {
  return tier === "Arcology" ? 4 : tier === "Metropolis" ? 3 : tier === "Colony" ? 2 : tier === "Outpost" ? 1 : 0;
}

function captureHabitat(game: GameState, habitat: HexState, attackerId: number): void {
  const attacker = game.players[attackerId], oldOwner = habitat.owner!;
  const capturedTier = habitat.tier;
  const priorEnhanced = habitat.enhancedCenterIndices?.length || 0;
  if (priorEnhanced) {
    const defender = game.players[oldOwner];
    defender.laborPenalty = Math.max(0, (defender.laborPenalty || 0) - priorEnhanced);
    defender.laborCap += priorEnhanced;
    defender.labor = Math.min(defender.laborCap, defender.labor + priorEnhanced);
  }
  habitat.owner = attackerId;
  if (habitat.kind === "home") habitat.portalDestinations = [];
  if (!(habitat.captureRewardedTo || []).includes(attackerId)) {
    const resource = habitat.kind === "home" ? game.players[oldOwner].lastHomeProduction || factionLibrary[game.players[oldOwner].faction].homeProduction : habitat.kind;
    if (resource === "material" || resource === "currency" || resource === "research" || resource === "influence") {
      attacker.resources[resource]++;
      habitat.captureRewardedTo = [...(habitat.captureRewardedTo || []), attackerId];
      game.log.unshift(`${attacker.name} seized 1 ${resource} at ${habitat.id}.`);
    }
  }
  habitat.combat = 0;
  habitat.pendingCombat = [];
  if (factionRules(attacker) !== "varkesh") habitat.tier = habitat.tier === "Metropolis" ? "Colony" : habitat.tier === "Colony" ? "Outpost" : habitat.tier;
  const excess = Math.max(0, habitat.centers.length - tierSlots(habitat.tier));
  habitat.enhancedCenterIndices = [];
  if (excess) game.pendingCenterLoss = { hexId: habitat.id, playerId: attackerId, removeCount: excess };
  attacker.legacyMetrics.habitatsCaptured[game.era - 1]++;
  if (capturedTier === "Metropolis") attacker.legacyMetrics.metropolisCaptured[game.era - 1]++;
  if (habitat.originalOwner !== undefined && habitat.originalOwner !== attackerId && !attacker.legacyMetrics.originalHabitatsCaptured.includes(habitat.originalOwner)) attacker.legacyMetrics.originalHabitatsCaptured.push(habitat.originalOwner);
  game.log.unshift(`${attacker.name} captured ${habitat.id} from ${game.players[oldOwner].name}${factionRules(attacker) === "varkesh" ? " without tier loss" : ""}.`);
}

export function removeCapturedCenter(game: GameState, playerId: number, centerIndex: number): { ok: boolean; message: string } {
  const pending = game.pendingCenterLoss;
  if (!pending || pending.playerId !== playerId) return { ok: false, message: "No captured Center decision is pending." };
  const habitat = game.hexes.find(hex => hex.id === pending.hexId);
  if (!habitat || centerIndex < 0 || centerIndex >= habitat.centers.length) return { ok: false, message: "That Center is unavailable." };
  const removed = removeCenterAt(habitat, centerIndex, game.players[playerId]);
  pending.removeCount--;
  game.log.unshift(`${game.players[playerId].name} destroyed the excess ${removed === "defense" ? "Defense Grid" : `${removed} Center`} at ${habitat.id}.`);
  if (pending.removeCount <= 0) game.pendingCenterLoss = undefined;
  return { ok: true, message: "Captured Center removed." };
}

function awardVarkesh(game: GameState, winnerId: number, opponents: number[]): void {
  const winner = game.players[winnerId] as PlayerState & { gloryAwards?: { turn: number; opponents: number[] } };
  for (const opponent of opponents)
    if (!winner.legacyMetrics.combatWinsAgainst.includes(opponent)) winner.legacyMetrics.combatWinsAgainst.push(opponent);
  if (factionRules(winner) !== "varkesh") return;
  if (!winner.gloryAwards || winner.gloryAwards.turn !== game.turn) winner.gloryAwards = { turn: game.turn, opponents: [] };
  opponents.forEach(opponent => {
    if (!winner.gloryAwards!.opponents.includes(opponent)) {
      winner.gloryAwards!.opponents.push(opponent);
      winner.lp += game.era;
      winner.legacy.faction += game.era;
      game.log.unshift(`${winner.name} gained ${game.era} LP from Glory in Battle against ${game.players[opponent].name}.`);
    }
  });
}

type SimultaneousCarrierMove = {
  playerId: number;
  carrierIds: string[];
  origin: string;
  destination: string;
};

function carrierForce(game: GameState, ids: string[]) {
  return game.carriers.filter((carrier) => ids.includes(carrier.id));
}

function carrierCombatStrength(game: GameState, carrier: CarrierState, defending = false) {
  const definition = carrierLibrary[carrier.type];
  let intrinsic = definition.intrinsicCS || 0;
  if (defending && carrier.type === "gunneryPlatform" && game.mobileHabitats.some((mobile) => mobile.owner === carrier.owner && mobile.hex === carrier.hex)) intrinsic = 6;
  return carrier.cu + intrinsic;
}

function hostile(game: GameState, a: number, b: number, habitatOwner?: number) {
  return (
    a !== b &&
    !hasAgreement(game, a, b, "alliance") &&
    !(hasBenefit(game, a, b, "defensive") && (
      habitatOwner === a ? hasStationingPermission(game, a, b, "defensive") :
      habitatOwner === b ? hasStationingPermission(game, b, a, "defensive") :
      hasStationingPermission(game, a, b, "defensive") || hasStationingPermission(game, b, a, "defensive")
    ))
  );
}

function engagementPolicy(game: GameState, initiator: number) {
  if (activePolicy(game) !== "rules-of-engagement" || policyUsed(game, initiator, "combat", "turn")) return;
  markPolicyUsed(game, initiator, "combat", "turn");
  const player = game.players[initiator];
  if (player.resources.influence > 0) player.resources.influence--;
  game.log.unshift(`${player.name} initiated hostile combat under Rules of Engagement and lost 1 Influence if available.`);
}

function removeForce(game: GameState, force: CarrierState[]) {
  const ids = new Set(force.map((carrier) => carrier.id));
  destroyLoadedBlockades(game, ids);
  game.carriers = game.carriers.filter((carrier) => !ids.has(carrier.id));
}

function destroyUnguardedCivilianVessels(game: GameState, hexId: string) {
  // Colony Ships are noncombatants and deliberately excluded. Future Corsair
  // boarding must use its own faction capability, never ordinary combat.
  const militaryOwners = new Set(game.carriers.filter((carrier) => carrier.hex === hexId && carrier.cu > 0).map((carrier) => carrier.owner));
  const threatened = (owner: number) => [...militaryOwners].some((militaryOwner) => hostile(game, owner, militaryOwner));
  const destroyed = game.civilianUnits.filter((unit) => unit.hex === hexId && threatened(unit.owner));
  if (destroyed.length) {
    game.civilianUnits = game.civilianUnits.filter((unit) => !destroyed.some((candidate) => candidate.id === unit.id));
    destroyed.forEach((unit) => game.log.unshift(`${game.players[unit.owner].name}'s civilian vessel was destroyed at ${hexId}.`));
  }
  for (const player of game.players) {
    if (!threatened(player.id)) continue;
    const explorers = (player.explorationVessels || []).filter((unit) => unit.hex === hexId);
    if (explorers.length) {
      player.explorationVessels = player.explorationVessels.filter((unit) => unit.hex !== hexId);
      game.log.unshift(`${player.name}'s unescorted Exploration vessel${explorers.length === 1 ? " was" : "s were"} destroyed at ${hexId}.`);
      player.explorer = player.explorationVessels[0]?.hex || "";
    }
  }
}

function queueCombatRedistribution(game: GameState, hexId: string) {
  const owners = new Set(game.carriers.filter((carrier) => carrier.hex === hexId).map((carrier) => carrier.owner));
  const habitat = game.hexes.find((hex) => hex.id === hexId && hex.tier);
  if (habitat?.owner !== undefined) owners.add(habitat.owner);
  for (const playerId of owners) {
    const carriers = game.carriers.filter((carrier) => carrier.hex === hexId && carrier.owner === playerId);
    const stationed = habitat?.owner === playerId ? habitat.combat : 0;
    const total = stationed + carriers.reduce((sum, carrier) => sum + carrier.cu, 0);
    if (!carriers.length || total <= carriers.length) continue;
    game.pendingCombatRedistributions = game.pendingCombatRedistributions.filter((pending) => !(pending.hexId === hexId && pending.playerId === playerId));
    game.pendingCombatRedistributions.push({ hexId, playerId, total, carrierIds: carriers.map((carrier) => carrier.id), allowStationed: habitat?.owner === playerId });
  }
}

export function redistributeCombatUnits(game: GameState, playerId: number, hexId: string, assignments: { carrierId: string; cu: number }[], stationed: number) {
  const pending = game.pendingCombatRedistributions.find((entry) => entry.playerId === playerId && entry.hexId === hexId);
  if (!pending) return { ok: false, message: "No post-combat redistribution is pending there." };
  const carriers = pending.carrierIds.map((id) => game.carriers.find((carrier) => carrier.id === id)).filter((carrier): carrier is CarrierState => !!carrier && carrier.owner === playerId && carrier.hex === hexId);
  if (assignments.length !== carriers.length || new Set(assignments.map((entry) => entry.carrierId)).size !== carriers.length) return { ok: false, message: "Assign every surviving military vessel exactly once." };
  if (!Number.isInteger(stationed) || stationed < 0 || (!pending.allowStationed && stationed > 0)) return { ok: false, message: "That stationed CU allocation is invalid." };
  for (const assignment of assignments) {
    const carrier = carriers.find((candidate) => candidate.id === assignment.carrierId);
    if (!carrier || !Number.isInteger(assignment.cu) || assignment.cu < 1 || assignment.cu > carrierLibrary[carrier.type].capacity) return { ok: false, message: "Each vessel needs at least 1 CU and cannot exceed Capacity." };
  }
  if (stationed + assignments.reduce((sum, entry) => sum + entry.cu, 0) !== pending.total) return { ok: false, message: `Allocate exactly ${pending.total} surviving CU.` };
  assignments.forEach((assignment) => { game.carriers.find((carrier) => carrier.id === assignment.carrierId)!.cu = assignment.cu; });
  const habitat = game.hexes.find((hex) => hex.id === hexId && hex.owner === playerId && hex.tier);
  if (habitat) habitat.combat = stationed;
  game.pendingCombatRedistributions = game.pendingCombatRedistributions.filter((entry) => entry !== pending);
  return { ok: true, message: `Post-combat CU redistribution completed at ${hexId}.` };
}

function resolveEdgePair(
  game: GameState,
  first: SimultaneousCarrierMove,
  second: SimultaneousCarrierMove,
) {
  const a = carrierForce(game, first.carrierIds),
    b = carrierForce(game, second.carrierIds),
    aCS = a.reduce((sum, carrier) => sum + carrierCombatStrength(game, carrier), 0),
    bCS = b.reduce((sum, carrier) => sum + carrierCombatStrength(game, carrier), 0);
  if (aCS === bCS) {
    removeForce(game, [...a, ...b]);
    game.log.unshift(
      `Edge combat between ${first.origin} and ${first.destination} destroyed both ${aCS} CS forces.`,
    );
    return;
  }
  const winner = aCS > bCS ? a : b,
    loser = aCS > bCS ? b : a,
    winningMove = aCS > bCS ? first : second,
    losingMove = aCS > bCS ? second : first,
    survivors = Math.abs(aCS - bCS);
  removeForce(game, loser);
  trimCarriers(game, winner, survivors);
  carrierForce(game, winningMove.carrierIds).forEach((carrier) => {
    carrier.lastHex = carrier.hex;
    carrier.hex = winningMove.destination;
    carrier.movesRemaining--;
  });
  awardVarkesh(game, winningMove.playerId, [losingMove.playerId]);
  game.log.unshift(
    `${game.players[winningMove.playerId].name} won edge combat ${aCS} CS to ${bCS} CS and completed movement.`,
  );
}

function resolveSimultaneousHex(game: GameState, destination: string) {
  const carriers = game.carriers.filter((carrier) => carrier.hex === destination),
    habitat = game.hexes.find((hex) => hex.id === destination && hex.tier),
    owners = new Set(carriers.map((carrier) => carrier.owner));
  const hostileBlockades = game.blockades.filter((blockade) =>
    blockade.hex === destination &&
    blockade.active &&
    carriers.some((carrier) => carrier.owner !== blockade.owner && !hasBenefit(game, carrier.owner, blockade.owner, "openBorders")),
  );
  hostileBlockades.forEach((blockade) => owners.add(blockade.owner));
  game.mobileHabitats.filter((mobile) => mobile.hex === destination && mobile.deployed).forEach((mobile) => owners.add(mobile.owner));
  if (habitat?.owner !== undefined) owners.add(habitat.owner);
  const involved = [...owners];
  if (
    involved.length < 2 ||
    !involved.some((a) => involved.some((b) => hostile(game, a, b, habitat?.owner)))
  )
    return;

  const forces = involved.map((owner) => {
    const fleet = carriers.filter((carrier) => carrier.owner === owner),
      stationed = habitat?.owner === owner ? habitat.combat : 0,
      assaultReduction =
        habitat?.owner === owner &&
        carriers.some(
          (carrier) =>
            carrier.owner !== owner &&
            hostile(game, carrier.owner, owner, habitat.owner) &&
            carrier.type === "assault",
        )
          ? 1
          : 0,
      guard = habitat?.owner === owner ? Math.max(0, homeGuardStrength(game, habitat) - assaultReduction) : 0,
      blockadeCS = hostileBlockades.filter((blockade) => blockade.owner === owner).length * 4,
      caravanCS = game.mobileHabitats.filter((mobile) => mobile.hex === destination && mobile.owner === owner && mobile.deployed).reduce((sum, mobile) => sum + mobile.caravanGuards * 3, 0);
    return {
      owner,
      fleet,
      unitCS: fleet.reduce((sum, carrier) => sum + carrier.cu, 0) + stationed,
      totalCS:
        fleet.reduce((sum, carrier) => sum + carrierCombatStrength(game, carrier, true), 0) + stationed + guard + blockadeCS + caravanCS,
    };
  });

  // Alliances always operate as one coalition. A Defensive Pact joins a
  // co-stationed partner to the Habitat owner's defense when an outsider
  // attacks. This avoids the old result where friendly forces were counted as
  // opposition simply because they had separate owners.
  const parent = new Map(involved.map((owner) => [owner, owner]));
  const root = (owner: number): number => {
    const current = parent.get(owner)!;
    if (current === owner) return owner;
    const resolved = root(current);
    parent.set(owner, resolved);
    return resolved;
  };
  const unite = (a: number, b: number) => {
    const ar = root(a), br = root(b);
    if (ar !== br) parent.set(Math.max(ar, br), Math.min(ar, br));
  };
  for (let a = 0; a < involved.length; a++)
    for (let b = a + 1; b < involved.length; b++)
      if (
        hasAgreement(game, involved[a], involved[b], "alliance") ||
        (habitat?.owner !== undefined &&
          (involved[a] === habitat.owner || involved[b] === habitat.owner) &&
          hasBenefit(game, involved[a], involved[b], "defensive") &&
          hasStationingPermission(game, habitat.owner, involved[a] === habitat.owner ? involved[b] : involved[a], "defensive"))
      )
        unite(involved[a], involved[b]);

  const coalitions = new Map<number, typeof forces>();
  for (const force of forces) {
    const coalition = root(force.owner);
    coalitions.set(coalition, [...(coalitions.get(coalition) || []), force]);
  }
  const coalitionForces = [...coalitions.entries()].map(([id, members]) => ({
    id,
    members,
    owners: members.map((member) => member.owner),
    fleet: members.flatMap((member) => member.fleet),
    unitCS: members.reduce((sum, member) => sum + member.unitCS, 0),
    totalCS: members.reduce((sum, member) => sum + member.totalCS, 0),
  }));
  const coalitionsHostile = (a: typeof coalitionForces[number], b: typeof coalitionForces[number]) =>
    a.owners.some((ownerA) => b.owners.some((ownerB) => hostile(game, ownerA, ownerB, habitat?.owner)));
  const participating = coalitionForces.filter((coalition) => coalitionForces.some((other) => other.id !== coalition.id && coalitionsHostile(coalition, other)));
  const blockadeOnlyBattle = participating.some((coalition) =>
    coalition.unitCS === 0 &&
    coalition.totalCS > 0 &&
    coalition.owners.every((owner) => hostileBlockades.some((blockade) => blockade.owner === owner)),
  );
  const strongest = [...participating].sort((a, b) => b.totalCS - a.totalCS || a.id - b.id)[0];
  const oppositionCoalitions = participating.filter((coalition) => coalition.id !== strongest.id && coalitionsHostile(strongest, coalition));
  const opposition = oppositionCoalitions.reduce((sum, coalition) => sum + coalition.totalCS, 0);
  const tiedStrongest = oppositionCoalitions.some((coalition) => coalition.totalCS === strongest.totalCS);
  if (tiedStrongest || strongest.totalCS <= opposition) {
    removeForce(game, participating.flatMap((coalition) => coalition.fleet));
    game.blockades.filter((blockade) => blockade.hex === destination && participating.some((coalition) => coalition.owners.includes(blockade.owner))).forEach((blockade) => { blockade.active = false; });
    game.mobileHabitats.filter((mobile) => mobile.hex === destination && participating.some((coalition) => coalition.owners.includes(mobile.owner))).forEach((mobile) => { mobile.caravanGuards = 0; });
    if (habitat?.owner !== undefined && participating.some((coalition) => coalition.owners.includes(habitat.owner!))) habitat.combat = 0;
    game.log.unshift(
      `Coalition combat at ${destination} ended in mutual destruction.`,
    );
    return;
  }

  const survivingUnits = Math.max(1, strongest.unitCS - opposition);
  for (const coalition of oppositionCoalitions) removeForce(game, coalition.fleet);
  const defeatedOwners = new Set(oppositionCoalitions.flatMap((coalition) => coalition.owners));
  game.blockades.filter((blockade) => blockade.hex === destination && defeatedOwners.has(blockade.owner)).forEach((blockade) => { blockade.active = false; });
  game.mobileHabitats.filter((mobile) => mobile.hex === destination && defeatedOwners.has(mobile.owner)).forEach((mobile) => { mobile.caravanGuards = 0; });
  const habitatHeld = habitat?.owner !== undefined && strongest.owners.includes(habitat.owner);
  if (habitat && habitatHeld) {
    const defender = game.players[habitat.owner!];
    defender.legacyMetrics.defendedHabitats ||= [];
    if (!defender.legacyMetrics.defendedHabitats.includes(habitat.id)) defender.legacyMetrics.defendedHabitats.push(habitat.id);
    habitat.combat = Math.min(habitat.combat, survivingUnits);
    trimCarriers(game, strongest.fleet, Math.max(0, survivingUnits - habitat.combat));
  } else {
    trimCarriers(game, strongest.fleet, survivingUnits);
    if (habitat) {
      const captor = [...strongest.members]
        .filter((member) => member.fleet.length)
        .sort((a, b) => b.fleet.reduce((sum, carrier) => sum + carrier.cu, 0) - a.fleet.reduce((sum, carrier) => sum + carrier.cu, 0) || a.owner - b.owner)[0];
      if (captor) captureHabitat(game, habitat, captor.owner);
    }
  }
  const defeated = oppositionCoalitions.flatMap((coalition) => coalition.owners);
  recordGunForHire(game, destination, defeated, strongest.owners);
  if (!blockadeOnlyBattle) strongest.owners.forEach((owner) => awardVarkesh(game, owner, defeated));
  const winners = strongest.owners.map((owner) => game.players[owner].name).join(" and ");
  game.log.unshift(
    `${winners} won coalition combat at ${destination}, ${strongest.totalCS} CS to ${opposition} combined opposition CS.`,
  );
}

/** Resolve military forces already occupying a Habitat that was established later in the same Turn. */
export function resolveNewHabitatOccupation(game: GameState, hexId: string) {
  const habitat = game.hexes.find((hex) => hex.id === hexId && hex.tier && hex.owner !== undefined);
  if (!habitat) return;
  const hostileForce = game.carriers.some(
    (carrier) => carrier.hex === hexId && carrier.cu > 0 &&
      !hasBenefit(game, habitat.owner!, carrier.owner, "nonAggression") &&
      !hasBenefit(game, habitat.owner!, carrier.owner, "openBorders") &&
      hostile(game, habitat.owner!, carrier.owner, habitat.owner),
  );
  if (!hostileForce) return;
  resolveSimultaneousHex(game, hexId);
  queueCombatRedistribution(game, hexId);
}

function resolveCarrierMoveStep(
  game: GameState,
  requested: Array<{
    playerId: number;
    carrierIds: string[];
    destination: string;
  }>,
) {
  const map = mapLibrary[game.mapId],
    used = new Set<string>(),
    moves: SimultaneousCarrierMove[] = [];
  for (const order of requested) {
    const force = carrierForce(game, order.carrierIds),
      origin = force[0]?.hex;
    if (
      !force.length ||
      !origin ||
      force.some(
        (carrier) =>
          carrier.owner !== order.playerId ||
          carrier.hex !== origin ||
          carrier.readyTurn > game.turn ||
          carrier.movesRemaining < 1 ||
          carrier.cu < 1 ||
          used.has(carrier.id),
      ) ||
      !(getNeighbors(origin, map).includes(order.destination) || (portalNeighbors(game, order.playerId, origin).includes(order.destination) && force.every((carrier) => carrier.portalUsedTurn !== game.turn))) ||
      game.hexes.find((hex) => hex.id === order.destination)?.revealed !== true ||
      game.hexes.find((hex) => hex.id === order.destination)?.kind === "rift"
    ) {
      game.log.unshift(
        `${game.players[order.playerId].name} submitted an invalid fleet movement order; the force held position.`,
      );
      continue;
    }
    force.forEach((carrier) => {
      used.add(carrier.id);
      if (!getNeighbors(origin, map).includes(order.destination)) carrier.portalUsedTurn = game.turn;
    });
    moves.push({ ...order, origin });
  }

  const edgeResolved = new Set<number>();
  for (let i = 0; i < moves.length; i++)
    for (let j = i + 1; j < moves.length; j++)
      if (
        !edgeResolved.has(i) &&
        !edgeResolved.has(j) &&
        moves[i].origin === moves[j].destination &&
        moves[i].destination === moves[j].origin &&
        hostile(game, moves[i].playerId, moves[j].playerId)
      ) {
        resolveEdgePair(game, moves[i], moves[j]);
        engagementPolicy(game, moves[i].playerId);
        engagementPolicy(game, moves[j].playerId);
        edgeResolved.add(i);
        edgeResolved.add(j);
      }

  moves.forEach((move, index) => {
    if (edgeResolved.has(index)) return;
    carrierForce(game, move.carrierIds).forEach((carrier) => {
      carrier.lastHex = carrier.hex;
      carrier.hex = move.destination;
      carrier.movesRemaining--;
    });
  });
  syncLoadedBlockades(game);
  const destinations = new Set(moves.map((move) => move.destination));
  const combatDestinations = new Set([...destinations].filter((destination) => {
    const habitat = game.hexes.find((hex) => hex.id === destination && hex.tier);
    const owners = new Set(game.carriers.filter((carrier) => carrier.hex === destination).map((carrier) => carrier.owner));
    if (habitat?.owner !== undefined) owners.add(habitat.owner);
    return [...owners].some((a) => [...owners].some((b) => hostile(game, a, b, habitat?.owner)));
  }));
  destinations.forEach((destination) =>
    resolveSimultaneousHex(game, destination),
  );
  for (const move of moves) if (combatDestinations.has(move.destination)) engagementPolicy(game, move.playerId);
  destinations.forEach((destination) =>
    destroyUnguardedCivilianVessels(game, destination),
  );
  combatDestinations.forEach((destination) => queueCombatRedistribution(game, destination));
  syncLoadedBlockades(game);
  game.selectedCarrierIds = game.selectedCarrierIds.filter((id) =>
    game.carriers.some((carrier) => carrier.id === id),
  );
}

export function resolveSimultaneousCarrierMoves(
  game: GameState,
  requested: Array<{ playerId: number; carrierIds: string[]; destination: string; path?: string[] }>,
) {
  const pending = requested.map((order) => {
    const origin = game.carriers.find((carrier) => order.carrierIds.includes(carrier.id))?.hex;
    const steps = order.path?.length ? [...order.path] : [order.destination];
    if (steps[0] === origin) steps.shift();
    return { ...order, steps };
  });
  const maximum = Math.max(0, ...pending.map((order) => order.steps.length));
  for (let step = 0; step < maximum; step++) {
    const batch = pending.filter((order) => order.steps[step]).map((order) => ({
      playerId: order.playerId,
      carrierIds: order.carrierIds,
      destination: order.steps[step],
    }));
    if (batch.length) resolveCarrierMoveStep(game, batch);
  }
}

/** Validate the exact path before accepting a fleet Order, not just its destination. */
export function validateCarrierRoute(game: GameState, playerId: number, carrierIds: string[], destination: string, path?: string[]) {
  const carriers = carrierIds.map((id) => game.carriers.find((carrier) => carrier.id === id));
  if (!carriers.length || new Set(carrierIds).size !== carrierIds.length || carriers.some((carrier) => !carrier || carrier.owner !== playerId))
    return { ok: false, message: "Select your military vessels for this route." };
  const origin = carriers[0]!.hex;
  if (carriers.some((carrier) => carrier!.hex !== origin || carrier!.readyTurn > game.turn || carrier!.cu < 1))
    return { ok: false, message: "All selected vessels must be ready, crewed, and in the same hex." };
  const steps = path?.length ? [...path] : [destination];
  if (steps[0] === origin) steps.shift();
  if (!steps.length || steps.at(-1) !== destination || steps.length > Math.min(...carriers.map((carrier) => carrier!.movesRemaining)))
    return { ok: false, message: "The planned route exceeds the task force's available movement." };
  const map = mapLibrary[game.mapId];
  let current = origin;
  let portalUsed = carriers.some((carrier) => carrier!.portalUsedTurn === game.turn);
  for (const step of steps) {
    const hex = game.hexes.find((candidate) => candidate.id === step);
    const neighboring = getNeighbors(current, map).includes(step);
    if (!hex?.revealed || hex.kind === "rift" || !(neighboring || portalNeighbors(game, playerId, current).includes(step)))
      return { ok: false, message: `The route through ${step} is not a contiguous revealed path.` };
    if (!neighboring) {
      if (portalUsed) return { ok: false, message: "A vessel may traverse only one portal per Turn." };
      portalUsed = true;
    }
    current = step;
  }
  return { ok: true, message: "Valid military route." };
}

function resolveCombat(game: GameState, attackerId: number, destination: string): void {
  const attackers = game.carriers.filter(carrier => carrier.hex === destination && carrier.owner === attackerId);
  const habitat = game.hexes.find(hex => hex.id === destination && hex.tier && hex.owner !== attackerId && hex.owner !== undefined && !hasBenefit(game, attackerId, hex.owner, "openBorders"));
  const hostileOwners = new Set<number>();
  game.carriers.filter(carrier => carrier.hex === destination && carrier.owner !== attackerId && !hasBenefit(game, attackerId, carrier.owner, "defensive")).forEach(carrier => hostileOwners.add(carrier.owner));
  if (habitat?.owner !== undefined) hostileOwners.add(habitat.owner);
  if (!hostileOwners.size) return;
  const defendingOwners = new Set(hostileOwners);
  if (habitat?.owner !== undefined)
    game.carriers.filter(carrier => carrier.hex === destination && carrier.owner !== attackerId && hasBenefit(game, habitat.owner!, carrier.owner, "defensive")).forEach(carrier => defendingOwners.add(carrier.owner));
  const hostileCarriers = game.carriers.filter(carrier => carrier.hex === destination && defendingOwners.has(carrier.owner));
  const attackCS = attackers.reduce((sum, carrier) => sum + carrierCombatStrength(game, carrier), 0);
  const defendingCU = hostileCarriers.reduce((sum, carrier) => sum + carrier.cu, 0) + (habitat?.combat || 0);
  const assaultReduction = habitat && attackers.some(carrier => carrier.type === "assault") ? 1 : 0;
  const homeGuard = habitat ? Math.max(0, homeGuardStrength(game, habitat) - assaultReduction) : 0;
  const defenseCS = defendingCU + homeGuard;
  const opponentIds = [...defendingOwners];
  if (attackCS > defenseCS) {
    trimCarriers(game, attackers, attackCS - defenseCS);
    destroyLoadedBlockades(game, hostileCarriers.map((carrier) => carrier.id));
    game.carriers = game.carriers.filter(carrier => !hostileCarriers.some(hostile => hostile.id === carrier.id));
    if (habitat) captureHabitat(game, habitat, attackerId);
    recordGunForHire(game, destination, opponentIds, [attackerId]);
    awardVarkesh(game, attackerId, opponentIds);
    game.log.unshift(`${game.players[attackerId].name} won fleet combat at ${destination}, ${attackCS} CS to ${defenseCS} CS.`);
    return;
  }
  destroyLoadedBlockades(game, attackers.map((carrier) => carrier.id));
  game.carriers = game.carriers.filter(carrier => !attackers.some(attacker => attacker.id === carrier.id));
  if (attackCS === defenseCS) {
    if (habitat) habitat.combat = 0;
    destroyLoadedBlockades(game, hostileCarriers.map((carrier) => carrier.id));
    game.carriers = game.carriers.filter(carrier => !hostileCarriers.some(hostile => hostile.id === carrier.id));
    game.log.unshift(`Fleet combat at ${destination} ended in mutual destruction at ${attackCS} CS each.`);
    return;
  }
  defenderCasualties(game, hostileCarriers, habitat, attackCS);
  recordGunForHire(game, destination, [attackerId], opponentIds);
  opponentIds.forEach(owner => awardVarkesh(game, owner, [attackerId]));
  game.log.unshift(`${game.players[attackerId].name} lost fleet combat at ${destination}, ${attackCS} CS to ${defenseCS} CS.`);
}

export function moveCarriers(game: GameState, playerId: number, carrierIds: string[], destination: string): { ok: boolean; message: string } {
  const carriers = carrierIds.map(id => game.carriers.find(carrier => carrier.id === id)).filter((carrier): carrier is CarrierState => !!carrier);
  if (!carriers.length || carriers.some(carrier => carrier.owner !== playerId)) return { ok: false, message: "Select at least one of your carriers." };
  const origin = carriers[0].hex;
  if (carriers.some(carrier => carrier.hex !== origin)) return { ok: false, message: "A task force must begin in one hex." };
  if (carriers.some(carrier => carrier.readyTurn > game.turn || carrier.movesRemaining < 1 || carrier.cu < 1)) return { ok: false, message: "Every selected carrier must be ready, crewed, and have movement remaining." };
  const portalStep = !getNeighbors(origin, mapLibrary[game.mapId]).includes(destination) && portalNeighbors(game, playerId, origin).includes(destination);
  if (portalStep && carriers.some((carrier) => carrier.portalUsedTurn === game.turn)) return { ok: false, message: "A vessel may traverse one portal per Turn." };
  if (!(getNeighbors(origin, mapLibrary[game.mapId]).includes(destination) || portalStep)) return { ok: false, message: "Task forces move one adjacent hex or use an owned portal." };
  const target = game.hexes.find(hex => hex.id === destination);
  if (!target || target.kind === "rift" || !target.revealed) return { ok: false, message: "Military carriers cannot enter that hex." };
  const encounteredOwners = new Set<number>();
  game.carriers.filter(carrier => carrier.hex === destination && carrier.owner !== playerId).forEach(carrier => encounteredOwners.add(carrier.owner));
  if (target.owner !== undefined && target.owner !== playerId) encounteredOwners.add(target.owner);
  for (const owner of encounteredOwners) {
    const peacefulHabitatPassage = target.owner === owner && hasBenefit(game, playerId, owner, "openBorders");
    const peacefulFleetPresence = hasBenefit(game, playerId, owner, "defensive");
    if (!peacefulHabitatPassage && !peacefulFleetPresence && hasBenefit(game, playerId, owner, "nonAggression")) return { ok: false, message: `Your agreement with ${game.players[owner].name} blocks hostile movement.` };
  }
  const hostileEntry = [...encounteredOwners].some(owner => {
    const peacefulHabitatPassage = target.owner === owner && hasBenefit(game, playerId, owner, "openBorders");
    const peacefulFleetPresence = hasBenefit(game, playerId, owner, "defensive");
    return !peacefulHabitatPassage && !peacefulFleetPresence;
  });
  if (hostileEntry) game.players[playerId].legacyMetrics.combatInitiated[game.era - 1]++;
  carriers.forEach(carrier => { carrier.lastHex = carrier.hex; carrier.hex = destination; carrier.movesRemaining--; });
  if (portalStep) carriers.forEach((carrier) => { carrier.portalUsedTurn = game.turn; });
  syncLoadedBlockades(game);
  resolveCombat(game, playerId, destination);
  if (hostileEntry) engagementPolicy(game, playerId);
  syncLoadedBlockades(game);
  game.selected = destination;
  game.selectedCarrierIds = game.selectedCarrierIds.filter(id => game.carriers.some(carrier => carrier.id === id));
  return { ok: true, message: `Task force moved to ${destination}.` };
}

export function taskForceSummary(game: GameState, carrierIds: string[]): { carriers: number; cu: number; movement: number } {
  const carriers = game.carriers.filter(carrier => carrierIds.includes(carrier.id));
  return { carriers: carriers.length, cu: carriers.reduce((sum, carrier) => sum + carrier.cu, 0), movement: carriers.length ? Math.min(...carriers.map(carrier => carrier.movesRemaining)) : 0 };
}

export function formatCost(cost: Record<string, number>): string {
  const labels: Record<string, string> = { material: "M", currency: "C", research: "R", influence: "I", labor: "L" };
  return Object.entries(cost).filter(([, amount]) => amount).map(([resource, amount]) => `${amount}${labels[resource] || resource[0].toUpperCase()}`).join(" · ");
}

export function totalCombatUnits(game: GameState, playerId: number): number {
  return game.carriers.filter(carrier => carrier.owner === playerId).reduce((sum, carrier) => sum + carrier.cu, 0) + game.hexes.filter(hex => hex.owner === playerId).reduce((sum, hex) => sum + hex.combat + (hex.pendingCombat || []).reduce((pending, force) => pending + force.amount, 0), 0);
}
