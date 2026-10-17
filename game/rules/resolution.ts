import type { GameState, PlayerResolutionBrief, Resource, SecretOrderSubmission, TechnologyBranch, TurnReplay } from "../types";
import { totalCombatUnits } from "./fleet";

type ResolutionSnapshot = {
  players: Array<{
    playerId: number;
    resources: Record<Resource, number>;
    labor: number;
    lp: number;
    habitats: number;
    combatUnits: number;
    tributes: number;
    tech: Record<TechnologyBranch, number>;
  }>;
  hexes: Array<{
    hexId: string;
    owner?: number;
    tier?: GameState["hexes"][number]["tier"];
    centers: GameState["hexes"][number]["centers"];
    combat: number;
  }>;
  units: Array<{ id: string; playerId: number; kind: "exploration" | "colony" | "carrier" | "civilian" | "mobileHabitat"; hexId: string; label: string }>;
};

export function captureResolutionSnapshot(game: GameState): ResolutionSnapshot {
  return {
    players: game.players.map((player) => ({
      playerId: player.id,
      resources: { ...player.resources },
      labor: player.labor,
      lp: player.lp,
      habitats: game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length,
      combatUnits: totalCombatUnits(game, player.id),
      tributes: player.tributes,
      tech: { ...player.tech },
    })),
    hexes: game.hexes.map((hex) => ({
      hexId: hex.id,
      owner: hex.owner,
      tier: hex.tier,
      centers: [...hex.centers],
      combat: hex.combat,
    })),
    units: [
      ...game.players.flatMap((player) => [
        ...player.explorationVessels.map((unit) => ({ id: unit.id, playerId: player.id, kind: "exploration" as const, hexId: unit.hex, label: unit.type })),
        ...player.colonyShips.map((unit) => ({ id: unit.id, playerId: player.id, kind: "colony" as const, hexId: unit.hex, label: "Colony Ship" })),
      ]),
      ...game.carriers.map((unit) => ({ id: unit.id, playerId: unit.owner, kind: "carrier" as const, hexId: unit.hex, label: unit.type })),
      ...game.civilianUnits.map((unit) => ({ id: unit.id, playerId: unit.owner, kind: "civilian" as const, hexId: unit.hex, label: unit.type })),
      ...game.mobileHabitats.map((unit) => ({ id: unit.id, playerId: unit.owner, kind: "mobileHabitat" as const, hexId: unit.hex, label: unit.type })),
    ],
  };
}

function currentUnits(game: GameState) {
  return [
    ...game.players.flatMap((player) => [
      ...player.explorationVessels.map((unit) => ({ id: unit.id, playerId: player.id, kind: "exploration" as const, hexId: unit.hex, label: unit.type })),
      ...player.colonyShips.map((unit) => ({ id: unit.id, playerId: player.id, kind: "colony" as const, hexId: unit.hex, label: "Colony Ship" })),
    ]),
    ...game.carriers.map((unit) => ({ id: unit.id, playerId: unit.owner, kind: "carrier" as const, hexId: unit.hex, label: unit.type })),
    ...game.civilianUnits.map((unit) => ({ id: unit.id, playerId: unit.owner, kind: "civilian" as const, hexId: unit.hex, label: unit.type })),
    ...game.mobileHabitats.map((unit) => ({ id: unit.id, playerId: unit.owner, kind: "mobileHabitat" as const, hexId: unit.hex, label: unit.type })),
  ];
}

export function buildTurnReplay(
  game: GameState,
  before: ResolutionSnapshot,
  submissions: SecretOrderSubmission[],
  resolvedTurn: number,
  resolvedEra: number,
  events: string[],
): TurnReplay {
  const afterUnits = currentUnits(game);
  const movements: TurnReplay["movements"] = [];
  for (const submission of submissions) for (const order of submission.orders) {
    const ids = order.kind === "carrierMove"
      ? order.carrierIds
      : order.kind === "explorerMove"
        ? [order.vesselId || game.players[submission.playerId]?.explorationVessels[0]?.id || `exploration-${submission.playerId}-1`]
        : order.kind === "colonyMove"
          ? [order.vesselId || game.players[submission.playerId]?.colonyShips[0]?.id || `colony-${submission.playerId}-1`]
          : order.kind === "civilianMove"
            ? [order.unitId]
            : order.kind === "migration"
              ? [order.mobileHabitatId]
            : [];
    if (!ids.length || !("destination" in order)) continue;
    const origins = ids.map((id) => before.units.find((unit) => unit.id === id)?.hexId).filter((hexId): hexId is string => Boolean(hexId));
    if (!origins.length) continue;
    const surviving = ids.map((id) => afterUnits.find((unit) => unit.id === id));
    const completed = surviving.every((unit) => unit?.hexId === order.destination);
    movements.push({
      playerId: submission.playerId,
      unitKind: order.kind === "carrierMove" ? "carrier" : order.kind === "explorerMove" ? "exploration" : order.kind === "colonyMove" ? "colony" : order.kind === "migration" ? "mobileHabitat" : "civilian",
      unitIds: [...ids],
      fromHexId: origins[0],
      toHexId: order.destination,
      path: "path" in order && order.path?.length ? [...order.path] : [origins[0], order.destination],
      outcome: surviving.every(Boolean) ? completed ? "completed" : "blocked" : "destroyed",
    });
  }

  const hexChanges: TurnReplay["hexChanges"] = [];
  for (const hex of game.hexes) {
    const prior = before.hexes.find((candidate) => candidate.hexId === hex.id);
    if (!prior) continue;
    const addedUnits = afterUnits.filter((unit) => unit.hexId === hex.id && !before.units.some((candidate) => candidate.id === unit.id)).map((unit) => unit.label);
    const centersAdded = hex.centers.filter((center, index) => index >= prior.centers.length || !prior.centers.includes(center));
    if (prior.owner === hex.owner && prior.tier === hex.tier && !centersAdded.length && prior.combat === hex.combat && !addedUnits.length) continue;
    hexChanges.push({
      hexId: hex.id,
      ownerBefore: prior.owner,
      ownerAfter: hex.owner,
      tierBefore: prior.tier,
      tierAfter: hex.tier,
      centersAdded,
      combatUnitDelta: hex.combat - prior.combat,
      unitsAdded: addedUnits,
    });
  }

  const branches: TechnologyBranch[] = ["Military", "Economy", "Policy", "Exploration", "Resource"];
  return {
    turn: resolvedTurn,
    era: resolvedEra,
    resolvedAt: new Date().toISOString(),
    movements,
    hexChanges,
    factions: game.players.map((player) => {
      const prior = before.players.find((candidate) => candidate.playerId === player.id)!;
      const purchased = submissions.find((submission) => submission.playerId === player.id)?.orders
        .filter((order): order is Extract<typeof order, {kind:"construct"}> => order.kind === "construct" && order.construction.type === "recruit")
        .reduce((sum, order) => sum + (order.construction.type === "recruit" ? order.construction.pairs * 2 : 0), 0) || 0;
      return {
        playerId: player.id,
        technologyAdvanced: branches.filter((branch) => player.tech[branch] > prior.tech[branch]),
        gateContributions: player.tributes - prior.tributes,
        combatUnitsPurchased: purchased,
        combatUnitDelta: totalCombatUnits(game, player.id) - prior.combatUnits,
        habitatDelta: game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length - prior.habitats,
        legacyDelta: player.lp - prior.lp,
      };
    }),
    events: events.slice(0, 40),
  };
}

export function buildResolutionBriefs(
  game: GameState,
  before: ResolutionSnapshot,
  resolvedTurn: number,
  resolvedEra: number,
  events: string[],
): PlayerResolutionBrief[] {
  const resources: Resource[] = ["material", "currency", "research", "influence"];
  const branches: TechnologyBranch[] = ["Military", "Economy", "Policy", "Exploration", "Resource"];
  return game.players.map((player) => {
    const previous = before.players.find((candidate) => candidate.playerId === player.id)!;
    return {
      turn: resolvedTurn,
      era: resolvedEra,
      playerId: player.id,
      resourceDelta: Object.fromEntries(resources.map((resource) => [resource, player.resources[resource] - previous.resources[resource]])) as Record<Resource, number>,
      laborDelta: player.labor - previous.labor,
      lpDelta: player.lp - previous.lp,
      habitatDelta: game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length - previous.habitats,
      combatUnitDelta: totalCombatUnits(game, player.id) - previous.combatUnits,
      tributeDelta: player.tributes - previous.tributes,
      technology: branches.filter((branch) => player.tech[branch] > previous.tech[branch]),
      events: events.filter((event) => event.includes(player.name) || /Horizon Gate|combat|Agreement|Trade/i.test(event)).slice(0, 8),
    };
  });
}
