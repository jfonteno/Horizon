import { getNeighbors } from "../engine/geometry";
import { factionRules } from "../factions";
import { destroyLoadedBlockades } from "./blockades";
import { mapLibrary } from "../maps";
import type { CivilianUnitType, GameState, TradableResource, TradeBundle } from "../types";
import { canPay, spend } from "./economy";
import { claimHabitatConstruction } from "./fleet";
import { hasStationingPermission } from "./diplomacy";

export const civilianLibrary: Record<
  CivilianUnitType,
  {
    name: string;
    faction: string;
    move: number;
    cost: Record<string, number>;
    special: string;
  }
> = {
  prospector: {
    name: "Prospector",
    faction: "foundry",
    move: 1,
    cost: { material: 2, currency: 1, labor: 1 },
    special:
      "Prospect one eligible unclaimed world for 1 Material, once per hex.",
  },
  envoy: {
    name: "Envoy",
    faction: "aurelians",
    move: 2,
    cost: { material: 1, currency: 2, labor: 1 },
    special: "Hosted trades generate 1 Influence for the Aurelians.",
  },
  surveyor: {
    name: "Long-Range Surveyor",
    faction: "farbound",
    move: 1,
    cost: { material: 3, currency: 2, labor: 1 },
    special: "Privately survey any unrevealed hex once per Turn during Orders.",
  },
};

export function setHomeProductionChoice(game: GameState, playerId: number, resource: "material" | "currency" | "research") {
  const player = game.players[playerId], rules = factionRules(player);
  const allowed = rules === "varkesh" ? ["material", "currency"] : rules === "farbound" ? ["research", "currency"] : rules === "helix" ? ["research", "material", "currency"] : [];
  if (!allowed.includes(resource)) return { ok: false, message: "This faction does not have flexible Homeworld production." };
  if (!["negotiation", "orders"].includes(game.orderProtocol.phase) || game.orderProtocol.submissions.some((submission) => submission.playerId === playerId))
    return { ok: false, message: "Choose Homeworld production before sealing Orders." };
  player.homeProductionChoice = resource;
  return { ok: true, message: `${player.name} will produce ${resource} at its Homeworld next Production Phase.` };
}

function unitId(game: GameState, owner: number) {
  let i = game.civilianUnits.length + 1;
  while (game.civilianUnits.some((u) => u.id === `civilian-${owner}-${i}`)) i++;
  return `civilian-${owner}-${i}`;
}
export function availableCivilianType(
  game: GameState,
  playerId: number,
): CivilianUnitType | undefined {
  const p = game.players[playerId];
  if (p.tech.Exploration < 2) return;
  return factionRules(p) === "foundry"
    ? "prospector"
    : factionRules(p) === "aurelians"
      ? "envoy"
      : factionRules(p) === "farbound"
        ? "surveyor"
        : undefined;
}
export function buildCivilian(
  game: GameState,
  playerId: number,
  habitatId: string,
  type: CivilianUnitType,
) {
  const p = game.players[playerId],
    h = game.hexes.find((x) => x.id === habitatId),
    d = civilianLibrary[type];
  if (!h?.tier || h.owner !== playerId)
    return { ok: false, message: "Select one of your Habitats." };
  if (factionRules(p) !== d.faction || p.tech.Exploration < 2)
    return {
      ok: false,
      message: `${d.name} requires its matching faction at Exploration II.`,
    };
  if (!canPay(p, d.cost))
    return { ok: false, message: "You cannot afford that civilian vessel." };
  if (!claimHabitatConstruction(game, habitatId))
    return {
      ok: false,
      message: "That Habitat already used its Construction Order this Turn.",
    };
  spend(p, d.cost);
  game.civilianUnits.push({
    id: unitId(game, playerId),
    owner: playerId,
    type,
    hex: habitatId,
    readyTurn: game.turn + 1,
    movesRemaining: 0,
  });
  game.log.unshift(`${p.name} constructed a ${d.name} at ${habitatId}.`);
  return { ok: true, message: `${d.name} constructed for next Turn.` };
}
export function beginFactionTurn(game: GameState, playerId: number) {
  for (const u of game.civilianUnits.filter((x) => x.owner === playerId))
    u.movesRemaining =
      u.readyTurn <= game.turn ? civilianLibrary[u.type].move : 0;
}
export function moveCivilian(
  game: GameState,
  playerId: number,
  unitIdValue: string,
  destination: string,
) {
  const u = game.civilianUnits.find((x) => x.id === unitIdValue),
    target = game.hexes.find((x) => x.id === destination);
  if (!u || u.owner !== playerId)
    return { ok: false, message: "Select one of your faction vessels." };
  if (u.readyTurn > game.turn || u.movesRemaining < 1)
    return { ok: false, message: "That vessel cannot move again this Turn." };
  if (!target || target.kind === "rift" || !target.revealed)
    return {
      ok: false,
      message: "Faction vessels require a revealed navigable destination.",
    };
  if (u.type === "envoy" && target.owner !== undefined && target.owner !== playerId && !hasStationingPermission(game, target.owner, playerId, "envoy"))
    return { ok: false, message: `${game.players[target.owner].name} must grant Envoy-hosting permission first.` };
  if (!getNeighbors(u.hex, mapLibrary[game.mapId]).includes(destination))
    return {
      ok: false,
      message: "Faction vessels move through adjacent hexes.",
    };
  u.hex = destination;
  u.movesRemaining--;
  game.selected = destination;
  return {
    ok: true,
    message: `${civilianLibrary[u.type].name} moved to ${destination}.`,
  };
}
export function prospect(
  game: GameState,
  playerId: number,
  unitIdValue: string,
) {
  const p = game.players[playerId],
    u = game.civilianUnits.find((x) => x.id === unitIdValue),
    h = u && game.hexes.find((x) => x.id === u.hex);
  if (factionRules(p) !== "foundry" || u?.type !== "prospector")
    return { ok: false, message: "Select a Foundry Prospector." };
  if (u.usedTurn === game.turn)
    return { ok: false, message: "That Prospector already acted this Turn." };
  if (u.movesRemaining < civilianLibrary.prospector.move)
    return {
      ok: false,
      message: "Prospecting replaces this vessel's movement for the Turn.",
    };
  if (
    !h ||
    !h.revealed ||
    h.owner !== undefined ||
    h.prospected ||
    ![
      "material",
      "currency",
      "research",
      "influence",
      "labor",
      "barren",
    ].includes(h.kind)
  )
    return {
      ok: false,
      message:
        "Prospect requires an eligible revealed, unclaimed, unprospected world.",
    };
  h.prospected = true;
  u.usedTurn = game.turn;
  p.resources.material++;
  p.legacyMetrics.prospectedHexes.push(h.id);
  game.log.unshift(`${p.name} Prospected ${h.id} and gained 1 Material.`);
  return { ok: true, message: "Prospecting complete. Gained 1 Material." };
}
function recordSurvey(game: GameState, playerId: number, hexId: string, tradableTurn?: number) {
  const p = game.players[playerId],
    h = game.hexes.find((x) => x.id === hexId);
  if (
    !h ||
    h.revealed ||
    h.kind === "rift" ||
    p.privateSurveys.some((s) => s.hexId === hexId)
  ) return false;
  p.privateSurveys.push({
    hexId,
    kind: h.kind,
    surveyedTurn: game.turn,
    tradableTurn,
    soldTo: [],
  });
  h.surveyedBy ||= [];
  if (!h.surveyedBy.includes(playerId)) h.surveyedBy.push(playerId);
  return true;
}
export function negotiationSurvey(game: GameState, playerId: number, hexId: string) {
  const p = game.players[playerId];
  if (factionRules(p) !== "farbound")
    return { ok: false, message: "Negotiation Survey is a Farbound ability." };
  if (
    !["negotiation", "orders"].includes(game.orderProtocol.phase) ||
    game.orderProtocol.submissions.some((submission) => submission.playerId === playerId)
  )
    return {
      ok: false,
      message: "Survey intelligence must be gathered before this civilization seals its Orders.",
    };
  if (p.negotiationSurveyUsedTurn === game.turn)
    return {
      ok: false,
      message: "The Farbound already gathered survey intelligence this Turn.",
    };
  if (!recordSurvey(game, playerId, hexId, game.turn))
    return { ok: false, message: "Choose an unrevealed hex not already in the survey archive." };
  p.negotiationSurveyUsedTurn = game.turn;
  return {
    ok: true,
    message: `Negotiation survey recorded for ${hexId}. This intelligence may be traded this Turn.`,
    privateDetail: `${hexId}: ${game.hexes.find((hex) => hex.id === hexId)!.kind}`,
  };
}
export function longRangeSurvey(
  game: GameState,
  playerId: number,
  unitIdValue: string,
  hexId: string,
) {
  const p = game.players[playerId],
    u = game.civilianUnits.find((x) => x.id === unitIdValue);
  if (factionRules(p) !== "farbound" || u?.type !== "surveyor")
    return { ok: false, message: "Select a Long-Range Surveyor." };
  if (p.surveyUsedTurn === game.turn || u.readyTurn > game.turn)
    return {
      ok: false,
      message: "Long-Range Survey is unavailable this Turn.",
    };
  if (!recordSurvey(game, playerId, hexId))
    return { ok: false, message: "Choose a publicly unrevealed hex not already surveyed." };
  p.surveyUsedTurn = game.turn;
  u.usedTurn = game.turn;
  return {
    ok: true,
    message: `Private long-range survey recorded for ${hexId}.`,
  };
}
export function surveyExchange(
  game: GameState,
  farboundId: number,
  buyerId: number,
  hexId: string,
  price: number,
) {
  const seller = game.players[farboundId],
    buyer = game.players[buyerId],
    survey = seller.privateSurveys.find((s) => s.hexId === hexId),
    h = game.hexes.find((x) => x.id === hexId);
  if (seller.tech.Policy < 2)
    return {
      ok: false,
      message: "Survey Exchange requires Policy II.",
    };
  if (factionRules(seller) !== "farbound" || !survey || h?.revealed)
    return {
      ok: false,
      message: "Only unrevealed Farbound survey data may be sold.",
    };
  if (survey.tradableTurn !== undefined && survey.tradableTurn !== game.turn)
    return {
      ok: false,
      message: "Survey intelligence is tradable only during the Turn it was gathered.",
    };
  if (price < 0 || buyer.resources.currency < price)
    return {
      ok: false,
      message: "The buyer cannot pay the agreed Currency price.",
    };
  buyer.resources.currency -= price;
  seller.resources.currency += price;
  if (!survey.soldTo.includes(buyerId)) survey.soldTo.push(buyerId);
  if (!seller.legacyMetrics.surveySales.includes(buyerId))
    seller.legacyMetrics.surveySales.push(buyerId);
  game.log.unshift(
    `${seller.name} sold survey data for ${hexId} to ${buyer.name}.`,
  );
  return {
    ok: true,
    message: `Survey sold. The buyer privately learns ${hexId} is ${survey.kind}.`,
    privateDetail: `${hexId}: ${survey.kind}`,
  };
}
export function brokerTrade(
  game: GameState,
  meridianId: number,
  a: number,
  b: number,
  aGives: TradeBundle,
  bGives: TradeBundle,
) {
  const broker = game.players[meridianId],
    pa = game.players[a],
    pb = game.players[b];
  if (factionRules(broker) !== "meridian" || new Set([meridianId, a, b]).size < 3)
    return {
      ok: false,
      message: "Brokerage requires the Meridian and two other civilizations.",
    };
  const pair = [a, b].sort((x, y) => x - y).join("-");
  if (broker.legacyMetrics.brokeragePairs.includes(`${game.turn}:${pair}`))
    return {
      ok: false,
      message: "That civilization pair was already brokered this Turn.",
    };
  const tradeResources = ["material", "currency", "research"] as TradableResource[];
  if ([aGives, bGives].some((bundle) => !bundle || ["material", "currency", "research", "labor"].some((key) => !Number.isSafeInteger(bundle[key as keyof TradeBundle]) || (bundle[key as keyof TradeBundle] || 0) < 0)))
    return { ok: false, message: "Brokered trade amounts must be non-negative integers." };
  if (tradeResources.every((resource) => aGives[resource] === 0) || tradeResources.every((resource) => bGives[resource] === 0))
    return { ok: false, message: "Both civilizations must contribute a resource to a brokered trade." };
  if (aGives.labor || bGives.labor)
    return {
      ok: false,
      message:
        "Brokerage currently handles Material, Currency, and Research. Labor requires direct agreements.",
    };
  for (const r of tradeResources)
    if (pa.resources[r] < aGives[r] || pb.resources[r] < bGives[r])
      return {
        ok: false,
        message: "One civilization cannot provide the agreed exchange.",
      };
  for (const r of tradeResources) {
    pa.resources[r] -= aGives[r];
    pb.resources[r] += aGives[r];
    pb.resources[r] -= bGives[r];
    pa.resources[r] += bGives[r];
  }
  const rewarded = !broker.legacyMetrics.brokeragePairs.some((entry) => entry.startsWith(`${game.turn}:`));
  if (rewarded) {
    broker.resources.currency++;
    broker.legacyMetrics.marketCurrencyEarned++;
  }
  broker.legacyMetrics.brokeragePairs.push(`${game.turn}:${pair}`);
  broker.legacyMetrics.brokerageTransactions++;
  game.log.unshift(
    `${broker.name} brokered a trade between ${pa.name} and ${pb.name}${rewarded ? ", gaining 1 Currency" : ""}.`,
  );
  return {
    ok: true,
    message: rewarded ? "Brokered trade completed. Meridian gained 1 Currency." : "Brokered trade completed. Meridian already earned its Brokerage Currency this Turn.",
  };
}
export function economicSalvage(game: GameState, playerId: number) {
  const p = game.players[playerId];
  if (factionRules(p) !== "meridian" || p.tech.Economy < 3)
    return {
      ok: false,
      message: "Economic Salvage requires the Meridian at Economy III.",
    };
  const stationed = game.hexes.filter((x) => x.owner === playerId).reduce((sum, h) => sum + h.combat, 0);
  const fleet = game.carriers.filter((carrier) => carrier.owner === playerId).reduce((sum, carrier) => sum + carrier.cu, 0);
  if (stationed + fleet < 4)
    return { ok: false, message: "Control at least 4 CU to salvage." };
  let remaining = 4;
  for (const h of game.hexes.filter(
    (x) => x.owner === playerId && x.combat > 0,
  )) {
    const n = Math.min(remaining, h.combat);
    h.combat -= n;
    remaining -= n;
    if (!remaining) break;
  }
  if (remaining) {
    const crewedIds = new Set(game.carriers.filter((carrier) => carrier.owner === playerId && carrier.cu > 0).map((carrier) => carrier.id));
    for (const carrier of game.carriers.filter((candidate) => candidate.owner === playerId).sort((a, b) => a.id.localeCompare(b.id))) {
      const removed = Math.min(remaining, carrier.cu);
      carrier.cu -= removed;
      remaining -= removed;
      if (!remaining) break;
    }
    const destroyed = game.carriers.filter((carrier) => crewedIds.has(carrier.id) && carrier.cu === 0);
    destroyLoadedBlockades(game, destroyed.map((carrier) => carrier.id));
    game.carriers = game.carriers.filter((carrier) => !destroyed.includes(carrier));
    destroyed.forEach(() => game.log.unshift(`${p.name} scrapped an uncrewed military vessel during Economic Salvage.`));
  }
  p.resources.currency++;
  p.legacyMetrics.marketCurrencyEarned++;
  return { ok: true, message: "Removed 4 CU and gained 1 Currency." };
}
