import { factionLibrary, factionRules } from "../factions";
import type { GameState, Resource, SecretOrder } from "../types";
import {
  buildCivilian,
  beginFactionTurn,
  civilianLibrary,
  longRangeSurvey,
  moveCivilian,
  prospect,
} from "./faction-operations";
import {
  beginFleetTurn,
  buildCarrier,
  carrierLibrary,
  claimHabitatConstruction,
  recruitCombatUnits,
  resolveNewHabitatOccupation,
  resolveSimultaneousCarrierMoves,
} from "./fleet";
import {
  canPay,
  centerCosts,
  economicHexKinds,
  spend,
  tributeCosts,
} from "./economy";
import {
  evaluateLegacy,
  finalizeGame,
  prepareHiddenChoicesForEra,
  scoreHiddenEra,
} from "./legacy";
import {
  processNewTurnDiplomacy,
  refreshContacts,
  researchAgreementDiscount,
  technologyCost,
} from "./diplomacy";
import { constructionQuote, projectedOrderBudget } from "./purchases";
import { recordGameSnapshot } from "../analytics";
import { beginExplorationTurn, buildExplorationVessel, farboundForwardScan, moveExplorationVessel, scanWithExplorationVessel } from "./exploration";
import { beginColonyTurn, buildColonyShip, findColonyShip, moveColonyShip, syncPrimaryColonyShip } from "./colony";
import { finalEra, gateTarget, totalTurns } from "./format";
import { buildResolutionBriefs, buildTurnReplay, captureResolutionSnapshot } from "./resolution";
import { beginShatteredTurn, habitatSlots, legalBombardmentTargets, produceShattered, resolveShatteredConstruction, resolveShatteredOrders } from "./shattered-reach";
import { removeCenterAt, resolvePortalOrder } from "./portals";
import { activePolicy, markPolicyUsed, policyCost, resolvePolicyVotes, startEraPolicy } from "./policy-deck";

export function beginSecretOrders(game: GameState) {
  if (game.result) return { ok: false, message: "The game is complete." };
  game.orderProtocol = {
    phase: "orders",
    turn: game.turn,
    currentPlayer: 0,
    submissions: [],
    lastResolution: game.orderProtocol?.lastResolution || [],
  };
  game.active = 0;
  return { ok: true, message: "Secret Orders Phase begun." };
}

function startingHex(game: GameState, playerId: number) {
  return game.hexes.find(
    (hex) => hex.kind === "home" && hex.originalOwner === playerId,
  )?.id || game.players[playerId].explorer;
}

function duplicateVesselOrders(game: GameState, playerId: number, orders: SecretOrder[]) {
  const vesselOrders = new Map<string, SecretOrder[]>();
  const add = (id: string, order: SecretOrder) => vesselOrders.set(id, [...(vesselOrders.get(id) || []), order]);
  for (const order of orders) {
    if (order.kind === "carrierMove") order.carrierIds.forEach((id) => add(id, order));
    if (order.kind === "migration") add(order.mobileHabitatId, order);
    if (order.kind === "bombard") add(order.carrierId, order);
    if (order.kind === "blockadeCargo") {
      add(order.carrierId, order);
      add(order.blockadeId, order);
    }
    if (order.kind === "transferBlockade") add(order.blockadeId, order);
    if (
      order.kind === "civilianMove" ||
      order.kind === "prospect" ||
      order.kind === "longRangeSurvey"
    )
      add(order.unitId, order);
    if (order.kind === "explorerMove" || order.kind === "explorerScan" || order.kind === "farboundForwardScan")
      add(order.vesselId || "explorer", order);
    if (order.kind === "wayfarerDeepRecon") add(order.vesselId || "explorer", order);
    if (order.kind === "openPortal") add(order.vesselId, order);
    if (order.kind === "colonyMove" || order.kind === "establish")
      add(order.vesselId || game.players[playerId].colonyShips[0]?.id || "colony", order);
  }
  return [...vesselOrders.values()].some((assigned) => {
    if (assigned.length <= 1) return false;
    const kinds = new Set(assigned.map((order) => order.kind));
    if ([...kinds].every((kind) => kind === "blockadeCargo")) {
      const actions = new Set(assigned.map((order) => order.kind === "blockadeCargo" ? order.action : ""));
      return actions.size > 1;
    }
    if (assigned.length !== 2) return true;
    const farboundMoveAndScan = factionRules(game.players[playerId]) === "farbound" && kinds.has("explorerMove") && kinds.has("farboundForwardScan");
    const carrierMoveAndBombardOne = kinds.has("carrierMove") && assigned.some((order) => order.kind === "bombard" && order.strength === 1);
    return !farboundMoveAndScan && !carrierMoveAndBombardOne;
  });
}

export function submitSecretOrders(
  game: GameState,
  playerId: number,
  orders: SecretOrder[],
) {
  const protocol = game.orderProtocol;
  if (protocol.phase === "negotiation") {
    protocol.phase = "orders";
  }
  if (
    protocol.phase !== "orders" ||
    protocol.turn !== game.turn ||
    protocol.currentPlayer !== playerId
  )
    return { ok: false, message: "It is not this civilization's Orders handoff." };
  if (protocol.submissions.some((submission) => submission.playerId === playerId))
    return { ok: false, message: "This civilization already sealed its Orders." };
  if ((game.turn - 1) % 4 === 0 && !game.players[playerId].hiddenLegacy[game.era]?.selected)
    return {
      ok: false,
      message: `Choose an Era ${game.era} Hidden Legacy objective before ending this Turn.`,
    };
  if (duplicateVesselOrders(game, playerId, orders))
    return { ok: false, message: "A vessel may issue only one Order per Turn, except a Farbound move with Forward Scan or a move with Bombardment 1." };
  for (const order of orders) {
    if (order.kind !== "bombard") continue;
    const move = orders.find((candidate): candidate is Extract<SecretOrder, { kind: "carrierMove" }> => candidate.kind === "carrierMove" && candidate.carrierIds.includes(order.carrierId));
    if (!legalBombardmentTargets(game, playerId, order.carrierId, undefined, move?.destination).some((target) => target.hexId === order.targetHexId))
      return { ok: false, message: `Bombardment of ${order.targetHexId} is outside range from the vessel's planned position.` };
  }
  for (const order of orders) {
    if (order.kind !== "colonyMove" && order.kind !== "establish") continue;
    const vessel = findColonyShip(game.players[playerId], order.vesselId);
    if (!vessel || vessel.owner !== playerId || vessel.readyTurn > game.turn)
      return { ok: false, message: "Choose one of your ready Colony Ships." };
  }
  const establishmentCount = orders.filter((order) => order.kind === "establish").length;
  const moduleConstructionCount = orders.filter(
    (order) => order.kind === "construct" && order.construction.type === "module",
  ).length;
  const availableModules = game.players[playerId].modules + moduleConstructionCount;
  if (establishmentCount > availableModules)
    return {
      ok: false,
      message: `You planned ${establishmentCount} Establish Orders but only ${availableModules} Habitat Module${availableModules === 1 ? " is" : "s are"} available. Construct another Module or remove an Establish Order.`,
    };
  if (orders.filter((order) => order.kind === "technology").length > 1)
    return { ok: false, message: "A civilization may advance Technology once per Turn." };
  if (orders.filter((order) => order.kind === "policyVote").length > 1)
    return { ok: false, message: "Only one Policy vote may be sealed per civilization per Era." };
  if (
    game.era < finalEra(game) &&
    orders.filter((order) => order.kind === "tribute").length > 1
  )
    return {
      ok: false,
      message: "A civilization may submit one Tribute Order per Turn before Era IV.",
    };

  const budget = projectedOrderBudget(game, playerId, orders);
  if (budget.error) return { ok: false, message: budget.error };

  protocol.submissions.push({
    playerId,
    turn: game.turn,
    sealedAt: new Date().toISOString(),
    orders: structuredClone(orders.length ? orders : [{ id: `hold-${playerId}`, kind: "hold" }]),
  });
  const next = game.players.find(
    (player) => !protocol.submissions.some((submission) => submission.playerId === player.id),
  );
  if (next) {
    protocol.currentPlayer = next.id;
    game.active = next.id;
    game.selected = startingHex(game, next.id);
    game.selectedCarrierIds = game.carriers
      .filter((carrier) => carrier.owner === next.id && carrier.hex === game.selected)
      .slice(0, 1)
      .map((carrier) => carrier.id);
    return { ok: true, message: `Orders submitted. Pass play to ${next.name}.` };
  }
  protocol.phase = "ready";
  protocol.currentPlayer = 0;
  game.active = 0;
  return { ok: true, message: "All Orders are sealed and ready to resolve." };
}

function resolveLongRangeSurveys(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  for (const { playerId, order } of orders)
    if (order.kind === "longRangeSurvey")
      longRangeSurvey(game, playerId, order.unitId, order.hexId);
    else if (order.kind === "farboundForwardScan")
      farboundForwardScan(game, playerId, order.vesselId, order.hexId);
    else if (order.kind === "explorerScan")
      scanWithExplorationVessel(game, playerId, order.vesselId, order.hexIds);
}

function resolveCivilianMovement(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  for (const { playerId, order } of orders) {
    if (order.kind === "explorerMove") moveExplorationVessel(game, playerId, order.vesselId, order.destination, order.path);
    if (order.kind === "colonyMove")
      moveColonyShip(game, playerId, order.vesselId, order.destination, order.path);
    if (order.kind === "civilianMove")
      moveCivilian(game, playerId, order.unitId, order.destination);
  }
}

function resolveLocations(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  for (const { playerId, order } of orders) {
    const player = game.players[playerId];
    if (order.kind === "prospect") prospect(game, playerId, order.unitId);
    if (order.kind !== "establish") continue;
    const hex = game.hexes.find((candidate) => candidate.id === order.hexId);
    const colonyShip = findColonyShip(player, order.vesselId);
    if (
      !hex ||
      colonyShip?.hex !== hex.id ||
      colonyShip.readyTurn > game.turn ||
      !hex.revealed ||
      !player.modules ||
      hex.owner !== undefined ||
      ["rift", "hazard", "anomaly", "empty"].includes(hex.kind)
    )
      continue;
    player.modules--;
    hex.owner = playerId;
    hex.originalOwner ??= playerId;
    hex.tier = "Outpost";
    player.legacyMetrics.habitatsEstablished[game.era - 1]++;
    syncPrimaryColonyShip(player);
    if (factionRules(player) === "farbound" && hex.surveyedBy?.includes(playerId)) {
      player.resources.material++;
      player.resources.currency++;
      if (
        !player.legacyMetrics.discountedHabitats.some((entry) =>
          entry.startsWith(`era-${game.era}:`),
        )
      )
        player.labor = Math.min(player.laborCap, player.labor + 1);
      player.legacyMetrics.discountedHabitats.push(`era-${game.era}:${hex.id}`);
      if (
        player.tech.Exploration >= 4 &&
        !player.legacyMetrics.frontierLegacyHexes.some((entry) => entry.endsWith(`:${hex.id}`)) &&
        !player.legacyMetrics.frontierLegacyHexes.some((entry) => entry.startsWith(`era-${game.era}:`))
      ) {
        player.legacyMetrics.frontierLegacyHexes.push(`era-${game.era}:${hex.id}`);
        player.lp += 2;
        player.legacy.faction += 2;
        game.log.unshift(`${player.name} gained 2 LP from Frontier Legacy at ${hex.id}.`);
      }
    }
    game.log.unshift(`${player.name} established an Outpost at ${hex.id}.`);
    resolveNewHabitatOccupation(game, hex.id);
  }
}

function constructionCost(
  game: GameState,
  playerId: number,
  habitatId: string,
  order: Extract<SecretOrder, { kind: "construct" }>,
) {
  const player = game.players[playerId],
    habitat = game.hexes.find((hex) => hex.id === habitatId),
    construction = order.construction;
  if (!habitat?.tier || habitat.owner !== playerId) return null;
  if (construction.type === "module")
    return { material: 3, currency: 2, labor: factionRules(player) === "foundry" ? 0 : 2 };
  if (construction.type === "upgrade")
    return habitat.tier === "Outpost"
      ? { material: 2, currency: factionRules(player) === "spires" ? 1 : 2, labor: 2 }
      : habitat.tier === "Colony"
        ? { material: 3, currency: factionRules(player) === "spires" ? 2 : 3, labor: 3 }
        : null;
  if (construction.type === "center") {
    if (construction.center === "defense") return { material: 2, currency: 1, labor: 1 };
    if (factionRules(player) === "helix" && construction.center === "research")
      return policyCost(game, playerId, "center", { material: 1, currency: 1, labor: 1 });
    const cost = { ...centerCosts[construction.center] };
    if (factionRules(player) === "guilds" && player.legacyMetrics.builtCenters[game.era - 1] === 0)
      cost.currency = Math.max(0, (cost.currency || 0) - 1);
    if (factionRules(player) === "aegis" && !player.legacyMetrics.aegisEconomicCenterBuilt)
      cost.currency = Math.max(0, (cost.currency || 0) - 1);
    return policyCost(game, playerId, "center", cost);
  }
  if (construction.type === "exploration") return {};
  return {};
}

function resolveConstruction(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
  include: (order: Extract<SecretOrder, { kind: "construct" }>) => boolean = () => true,
) {
  for (const { playerId, order } of orders) {
    if (order.kind !== "construct" || !include(order)) continue;
    const player = game.players[playerId],
      habitat = game.hexes.find((hex) => hex.id === order.habitatId),
      construction = order.construction;
    if (["arcology", "enhanceCenter", "factory", "mobileHabitat", "mobileCenter", "blockade", "caravanGuard"].includes(construction.type)) {
      resolveShatteredConstruction(game, playerId, order.habitatId, construction);
      continue;
    }
    if (construction.type === "carrier") {
      buildCarrier(game, playerId, order.habitatId, construction.carrier);
      continue;
    }
    if (construction.type === "recruit") {
      recruitCombatUnits(game, playerId, order.habitatId, construction.pairs);
      continue;
    }
    if (construction.type === "civilian") {
      buildCivilian(game, playerId, order.habitatId, construction.civilian);
      continue;
    }
    if (construction.type === "exploration") {
      buildExplorationVessel(game, playerId, order.habitatId, construction.vessel);
      continue;
    }
    if (construction.type === "removeCenter" || construction.type === "replaceCenter") {
      if (!habitat?.tier || habitat.owner !== playerId || habitat.constructionUsedTurn === game.turn || !Number.isInteger(construction.centerIndex) || !habitat.centers[construction.centerIndex]) continue;
      const quote = constructionQuote(game, playerId, habitat.id, construction);
      if (!quote.available || !canPay(player, quote.cost)) continue;
      if (!claimHabitatConstruction(game, habitat.id)) continue;
      spend(player, quote.cost);
      const removed = removeCenterAt(habitat, construction.centerIndex, player);
      if (construction.type === "replaceCenter") {
        habitat.centers.push(construction.center);
        if (construction.center === "defense" && ["spires", "aegis"].includes(factionRules(player))) habitat.defenseGridOrigin = factionRules(player);
        if (construction.center !== "defense" && factionRules(player) === "aegis") player.legacyMetrics.aegisEconomicCenterBuilt = true;
        player.legacyMetrics.builtCenters[game.era - 1]++;
        if (construction.center !== "defense" && activePolicy(game) === "infrastructure-grants") markPolicyUsed(game, playerId, "center");
      }
      game.log.unshift(`${player.name} ${construction.type === "replaceCenter" ? `replaced a ${removed} Center with ${construction.center}` : `removed a ${removed} Center`} at ${habitat.id}.`);
      continue;
    }
    if (construction.type === "colony") {
      buildColonyShip(game, playerId, order.habitatId);
      continue;
    }
    const cost = constructionCost(game, playerId, order.habitatId, order);
    if (!habitat?.tier || !cost || !canPay(player, cost)) continue;
    if (
      construction.type === "upgrade" &&
      ((factionRules(player) === "spires" && habitat.tier === "Colony") ||
        (habitat.tier !== "Outpost" && habitat.tier !== "Colony") ||
        (habitat.tier === "Outpost" && player.tech.Resource < 2) ||
        (habitat.tier === "Colony" && player.tech.Resource < 3))
    )
      continue;
    if (construction.type === "center") {
      const cap = habitatSlots(habitat.tier);
      if (habitat.centers.length + (habitat.portalDestinations?.length || 0) >= cap) continue;
      if (construction.center === "defense" && habitat.centers.includes("defense")) continue;
    }
    if (!claimHabitatConstruction(game, habitat.id)) continue;
    spend(player, cost);
    if (construction.type === "module") player.modules++;
    else if (construction.type === "upgrade") {
      habitat.tier = habitat.tier === "Outpost" ? "Colony" : "Metropolis";
      player.legacyMetrics.upgradedHabitats[game.era - 1]++;
      player.legacyMetrics.habitatDevelopmentHexes[game.era - 1].push(habitat.id);
    } else if (construction.type === "center") {
      habitat.centers.push(construction.center);
      if (construction.center !== "defense" && activePolicy(game) === "infrastructure-grants") markPolicyUsed(game, playerId, "center");
      if (factionRules(player) === "aegis" && construction.center !== "defense") player.legacyMetrics.aegisEconomicCenterBuilt = true;
      if (construction.center === "defense" && ["spires", "aegis"].includes(factionRules(player))) habitat.defenseGridOrigin = factionRules(player);
      player.legacyMetrics.builtCenters[game.era - 1]++;
      player.legacyMetrics.habitatDevelopmentHexes[game.era - 1].push(habitat.id);
    }
  }
}

function resolveTechnology(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  for (const { playerId, order } of orders) {
    if (order.kind !== "technology") continue;
    if (game.players[playerId].techAdvancedTurn === game.turn) continue;
    const player = game.players[playerId],
      next = player.tech[order.branch] + 1;
    if (next > 4) continue;
    const cost = technologyCost(game, playerId, order.branch, next);
    if (!canPay(player, cost)) continue;
    const discount = researchAgreementDiscount(game, player);
    spend(player, cost);
    if (activePolicy(game) === "scientific-exchange") markPolicyUsed(game, playerId, "technology");
    player.tech[order.branch] = next;
    player.techAdvancedTurn = game.turn;
    player.legacyMetrics.technologyAdvances[game.era - 1].push(order.branch);
    if (discount) player.diplomacy.researchDiscountEras.push(game.era);
  }
}

function resolveTributes(
  game: GameState,
  orders: Array<{ playerId: number; order: SecretOrder }>,
) {
  const target = gateTarget(game),
    remaining = new Map(
      game.players.map((player) => [player.id, structuredClone(player)]),
    ),
    projectedPolicy = { ...game, policyUses: { ...(game.policyUses || {}) } },
    accepted = new Map<number, number>(),
    valid: Array<{ playerId: number; order: SecretOrder }> = [];
  for (const entry of orders) {
    if (entry.order.kind !== "tribute") continue;
    const player = game.players[entry.playerId],
      budget = remaining.get(entry.playerId)!,
      count = accepted.get(entry.playerId) || 0;
    if (
      (game.era < finalEra(game) && (player.eraTributes[game.era - 1] || count > 0)) ||
      !canPay(budget, policyCost(projectedPolicy, entry.playerId, "tribute", tributeCosts[game.era]))
    )
      continue;
    spend(budget, policyCost(projectedPolicy, entry.playerId, "tribute", tributeCosts[game.era]));
    if (activePolicy(projectedPolicy) === "horizon-priority") markPolicyUsed(projectedPolicy, entry.playerId, "tribute");
    accepted.set(entry.playerId, count + 1);
    valid.push(entry);
  }
  for (const { playerId } of valid) {
    const player = game.players[playerId];
    const cost = policyCost(game, playerId, "tribute", tributeCosts[game.era]);
    spend(player, cost);
    if (activePolicy(game) === "horizon-priority") markPolicyUsed(game, playerId, "tribute");
    player.tributes++;
    player.eraTributes[game.era - 1]++;
    game.gateLedger ||= [];
    game.gateLedger.push({ turn: game.turn, era: game.era, playerId, cost: { ...cost } });
    game.log.unshift(`${player.name} fulfilled a sealed Horizon Gate Tribute Order.`);
  }
  game.gate = Math.min(target, game.gate + valid.length);
}

function produce(game: GameState, playerId: number) {
  const player = game.players[playerId],
    owned = game.hexes.filter((hex) => hex.owner === playerId),
    multiplier = player.tech.Resource === 4 ? 2 : 1,
    before = { ...player.resources };
  player.laborCap = Math.max(
    1,
    3 +
      player.laborBonus +
      owned.reduce(
        (sum, hex) =>
          sum +
          (hex.kind === "labor" ? multiplier : 0) +
          hex.centers.filter((center) => center === "labor").length * multiplier,
        0,
      ) - (player.laborPenalty || 0),
  );
  player.labor = player.laborCap;
  const defaultHome = factionLibrary[player.faction].homeProduction;
  const flexible = factionRules(player) === "varkesh"
    ? (["material", "currency"] as Resource[])
    : factionRules(player) === "helix"
      ? (["research", "material", "currency"] as Resource[])
    : factionRules(player) === "farbound"
      ? (["research", "currency"] as Resource[])
      : [defaultHome];
  const homeProduction = flexible.includes(player.homeProductionChoice || defaultHome)
    ? (player.homeProductionChoice || defaultHome)
    : defaultHome;
  player.resources[homeProduction] += multiplier;
  player.lastHomeProduction = homeProduction;
  for (const hex of owned) {
    if (
      economicHexKinds.includes(hex.kind as (typeof economicHexKinds)[number]) &&
      hex.kind !== "labor"
    )
      player.resources[hex.kind as Resource] += multiplier;
    for (const center of hex.centers)
      if (
        center !== "labor" &&
        economicHexKinds.includes(center as (typeof economicHexKinds)[number])
      )
        player.resources[center as Resource] += multiplier;
  }
  produceShattered(game, playerId);
  const eraIndex = game.era - 1,
    amounts = player.legacyMetrics.productionAmounts[eraIndex],
    types: (Resource | "labor")[] = [];
  let total = 0;
  for (const resource of ["material", "currency", "research", "influence"] as Resource[]) {
    const gain = player.resources[resource] - before[resource];
    amounts[resource] = Math.max(amounts[resource], gain);
    total += gain;
    if (gain > 0) types.push(resource);
  }
  player.legacyMetrics.productionTotals[eraIndex] = Math.max(
    player.legacyMetrics.productionTotals[eraIndex],
    total,
  );
  if (owned.some((hex) => hex.kind === "labor" || hex.centers.includes("labor")))
    types.push("labor");
  if (types.length > player.legacyMetrics.productionTypes[eraIndex].length)
    player.legacyMetrics.productionTypes[eraIndex] = types;
}

export function resolveSecretOrders(game: GameState) {
  if (game.orderProtocol.phase !== "ready")
    return { ok: false, message: "Every civilization must seal Orders first." };
  const resolutionBefore = captureResolutionSnapshot(game),
    resolvedSubmissions = structuredClone(game.orderProtocol.submissions),
    resolvedTurn = game.turn,
    resolvedEra = game.era,
    all = game.orderProtocol.submissions.flatMap((submission) =>
    submission.orders.map((order) => ({ playerId: submission.playerId, order })),
  );
  const before = game.log.length;
  game.orderProtocol.phase = "resolved";
  resolvePolicyVotes(game, all);
  resolveLongRangeSurveys(game, all);
  resolveShatteredOrders(game, all.filter((entry) => entry.order.kind !== "bombard"));
  resolveSimultaneousCarrierMoves(
    game,
    all
      .filter(
        (entry): entry is { playerId: number; order: Extract<SecretOrder, { kind: "carrierMove" }> } =>
          entry.order.kind === "carrierMove",
      )
      .map(({ playerId, order }) => ({
        playerId,
        carrierIds: order.carrierIds,
        destination: order.destination,
        path: order.path,
      })),
  );
  resolveShatteredOrders(game, all.filter((entry) => entry.order.kind === "bombard"));
  resolveCivilianMovement(game, all);
  // Habitat Modules are available to Establish Orders sealed for the same Turn.
  // All other construction still resolves after settlement as before.
  resolveConstruction(game, all, (order) => order.construction.type === "module");
  resolveLocations(game, all);
  for (const { playerId, order } of all) if (order.kind === "openPortal") resolvePortalOrder(game, playerId, order.vesselId, order.replaceCenterIndex);
  resolveConstruction(game, all, (order) => order.construction.type !== "module");
  resolveTechnology(game, all);
  resolveTributes(game, all);
  refreshContacts(game);
  evaluateLegacy(game);
  if (game.turn % 4 === 0) scoreHiddenEra(game, game.era);
  if (game.turn >= totalTurns(game)) finalizeGame(game);
  recordGameSnapshot(game, game.turn);
  if (!game.result) {
    game.turn++;
    const previousEra = game.era;
    game.era = Math.min(finalEra(game), Math.ceil(game.turn / 4));
    if (game.era !== previousEra) startEraPolicy(game);
    prepareHiddenChoicesForEra(game, game.era);
    processNewTurnDiplomacy(game, game.turn);
    for (const player of game.players) {
      player.disabled = false;
      produce(game, player.id);
      beginFleetTurn(game, player.id);
      beginFactionTurn(game, player.id);
      beginExplorationTurn(game, player.id);
      beginColonyTurn(game, player.id);
      beginShatteredTurn(game, player.id);
    }
    game.active = 0;
    game.selected = startingHex(game, 0);
    game.orderProtocol = {
      phase: game.spectatorMode ? "orders" : "negotiation",
      turn: game.turn,
      currentPlayer: 0,
      submissions: [],
      lastResolution: game.log.slice(0, game.log.length - before),
    };
  }
  const resolutionEvents = game.log.slice(0, game.log.length - before);
  game.resolutionBriefs = buildResolutionBriefs(game, resolutionBefore, resolvedTurn, resolvedEra, resolutionEvents);
  game.turnReplays = [...(game.turnReplays || []), buildTurnReplay(game, resolutionBefore, resolvedSubmissions, resolvedTurn, resolvedEra, resolutionEvents)].slice(-24);
  return { ok: true, message: "All sealed Orders resolved simultaneously." };
}

export function orderLabel(order: SecretOrder) {
  switch (order.kind) {
    case "hold":
      return order.label || "Hold";
    case "carrierMove":
      return `Move ${order.carrierIds.length} carrier${order.carrierIds.length === 1 ? "" : "s"} to ${order.destination}`;
    case "explorerMove":
      return `Explorer to ${order.destination}`;
    case "explorerScan":
      return `Public scan ${order.hexIds.join(", ")}`;
    case "farboundForwardScan":
      return `Private Forward Scan ${order.hexId}`;
    case "wayfarerDeepRecon":
      return `Private Deep Recon ${order.hexId}`;
    case "colonyMove":
      return `Colony Ship to ${order.destination}`;
    case "civilianMove":
      return `Faction vessel to ${order.destination}`;
    case "longRangeSurvey":
      return `Long-Range Survey ${order.hexId}`;
    case "establish":
      return `Establish Habitat at ${order.hexId}`;
    case "migration":
      return `Migrate ${order.mobileHabitatId} to ${order.destination}`;
    case "bombard":
      return `Bombard ${order.targetHexId}${order.strength ? ` at strength ${order.strength}` : ""}`;
    case "factoryOutput":
      return `Set Factory at ${order.habitatId} to ${order.output}`;
    case "transferBlockade":
      return `Transfer ${order.blockadeId} to ${order.toPlayerId}`;
    case "blockadeCargo":
      return `${order.action === "load" ? "Load" : "Deploy"} ${order.blockadeId} ${order.action === "load" ? "onto" : "from"} ${order.carrierId}`;
    case "prospect":
      return "Prospect current world";
    case "openPortal": return `Open Homeworld portal with ${order.vesselId}`;
    case "policyVote": return `Vote ${order.influence} Influence for ${order.policyId}`;
    case "construct":
      return `${order.construction.type === "module"
        ? "Habitat Module"
        : order.construction.type === "upgrade"
          ? "Habitat Upgrade"
          : order.construction.type === "center"
            ? order.construction.center === "defense" ? "Defense Grid" : `${order.construction.center[0].toUpperCase()}${order.construction.center.slice(1)} Center`
            : order.construction.type === "carrier"
              ? carrierLibrary[order.construction.carrier].name
              : order.construction.type === "colony"
                ? "Colony Ship"
                : order.construction.type === "civilian"
                  ? civilianLibrary[order.construction.civilian].name
              : order.construction.type === "exploration"
                    ? `${order.construction.vessel} exploration vessel`
                    : order.construction.type === "arcology"
                      ? "Arcology"
                      : order.construction.type === "removeCenter"
                        ? "Remove Center"
                      : order.construction.type === "replaceCenter"
                        ? "Replace Center"
                      : order.construction.type === "enhanceCenter"
                        ? "Enhanced Center"
                        : order.construction.type === "factory"
                          ? "Factory"
                      : order.construction.type === "mobileHabitat"
                            ? order.construction.vessel
                            : order.construction.type === "mobileCenter"
                              ? `${order.construction.center} Mobile Center`
                            : order.construction.type === "blockade"
                              ? "Blockade Platform"
                              : order.construction.type === "caravanGuard"
                                ? "Caravan Guard"
                    : `${order.construction.pairs * 2} Combat Units`} at ${order.habitatId}`;
    case "technology":
      return `Advance ${order.branch}`;
    case "tribute":
      return "Horizon Gate Tribute";
  }
}
