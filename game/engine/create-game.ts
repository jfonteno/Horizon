import { factionLibrary, type FactionId } from "../factions";
import { mapLibrary, type MapId } from "../maps";
import type {
  CarrierState,
  GameState,
  HexKind,
  HexState,
  PlayerState,
  PlayerController,
} from "../types";
import type { ThemeId } from "../themes";
import { seededRandom, shuffle } from "./random";
import { emptyLegacyMetrics } from "../rules/legacy";
import { recordGameSnapshot } from "../analytics";

export function createGame(
  playerCount: number,
  chosen: FactionId[],
  mapId: MapId = "shattered-reach",
  themeId: ThemeId = "horizon-base",
  seed = Math.floor(Date.now() % 1000000),
  controllers: PlayerController[] = [],
  spectatorMode = false,
): GameState {
  const map = mapLibrary[mapId];
  if (!map) throw new Error(`Map ${mapId} is not installed on this Horizon server.`);
  if (playerCount < (map.minPlayers || 1) || playerCount > (map.maxPlayers || map.starts.length))
    throw new Error(`${map.name} does not support ${playerCount} players.`);
  if (chosen.slice(0, playerCount).some((id) => !factionLibrary[id]))
    throw new Error("One or more selected factions are not installed on this Horizon server.");
  const
    random = seededRandom(seed),
    startingHexes = shuffle(
      map.starts.slice(0, playerCount),
      seededRandom((seed ^ 0x9e3779b9) >>> 0),
    ),
    openCount = map.rows * map.columns - map.blocked.size - map.starts.length;
  const pool = [...map.tilePool];
  while (pool.length < openCount) pool.push("empty");
  const mixed = shuffle(pool, random);
  let position = 0;
  const hexes: HexState[] = [];
  for (let row = 0; row < map.rows; row++)
    for (let col = 0; col < map.columns; col++) {
      const id = `${row}-${col}`,
        start = startingHexes.indexOf(id);
      if (map.blocked.has(id))
        hexes.push({
          id,
          row,
          col,
          kind: "rift",
          revealed: true,
          centers: [],
          combat: 0,
        });
      else if (start >= 0)
        hexes.push({
          id,
          row,
          col,
          kind: "home",
          revealed: true,
          owner: start,
          originalOwner: start,
          tier: "Colony",
          centers: [],
          combat: 2,
        });
      else
        hexes.push({
          id,
          row,
          col,
          kind: (mixed[position++] || "empty") as HexKind,
          revealed: false,
          centers: [],
          combat: 0,
        });
    }
  const players = chosen.slice(0, playerCount).map((faction, id) => {
    const definition = factionLibrary[faction];
    const player: PlayerState = {
      id,
      controller: controllers[id] || { kind: "human" },
      faction,
      rulesProfile: definition.rulesProfile,
      name: definition.name,
      color: definition.color,
      resources: { material: 0, currency: 0, research: 0, influence: 1 },
      laborCap: 3,
      laborBonus: 0,
      labor: 3,
      lp: 0,
      legacy: {
        universal: 0,
        civilization: 0,
        hidden: 0,
        faction: 0,
        manual: 0,
      },
      legacyMetrics: emptyLegacyMetrics(),
      civilizationClaims: [],
      hiddenLegacy: {},
      tributes: 0,
      eraTributes: [0, 0, 0, 0],
      tech: { Military: 1, Economy: 1, Policy: 1, Exploration: 1, Resource: 1 },
      explorer: startingHexes[id],
      colonyShip: startingHexes[id],
      modules: 1,
      disabled: false,
      objectives: [...definition.objectives],
      diplomacy: {
        contacts: [],
        firstAgreementPartners: [],
        firstTradeAgreementUsed: false,
        politicalLaborEras: [],
        researchDiscountEras: [],
        technologyExportPartners: [],
        bonusInfluenceGained: 0,
      },
      privateSurveys: [],
    };
    const starting = definition.starting;
    if (starting?.resources)
      for (const [resource, amount] of Object.entries(starting.resources))
        player.resources[resource as keyof typeof player.resources] = amount!;
    if (starting?.technology)
      for (const [branch, level] of Object.entries(starting.technology))
        player.tech[branch as keyof typeof player.tech] = level!;
    if (starting?.laborCap !== undefined) {
      player.laborCap = starting.laborCap;
      player.labor = starting.laborCap;
    }
    definition.initialize?.(player);
    const homeCenter = starting?.homeCenter || (faction === "foundry" ? "material" : undefined);
    if (homeCenter) hexes.find((hex) => hex.id === startingHexes[id])!.centers.push(homeCenter);
    return player;
  });
  const carriers: CarrierState[] = players.map((player) => ({
    id: `carrier-${player.id}-1`,
    owner: player.id,
    type: "patrol",
    hex: startingHexes[player.id],
    cu: 2,
    readyTurn: 1,
    movesRemaining: 2,
  }));
  const game: GameState = {
    schemaVersion: 14,
    mapId,
    contentPacks: [
      ...new Map(
        [map.sourcePack, ...players.map((player) => factionLibrary[player.faction].sourcePack)]
          .filter((pack): pack is string => Boolean(pack))
          .map((pack) => {
            const version = map.sourcePack === pack
              ? map.sourcePackVersion
              : players.map((player) => factionLibrary[player.faction]).find((definition) => definition.sourcePack === pack)?.sourcePackVersion;
            return [pack, { id: pack, version: version || "unknown" }];
          }),
      ).values(),
    ],
    themeId,
    seed,
    players,
    hexes,
    active: 0,
    turn: 1,
    era: 1,
    gate: 0,
    selected: startingHexes[0],
    mode: "inspect",
    moves: { explorer: 1, colony: 1 },
    carriers,
    civilianUnits: [],
    selectedCarrierIds: [carriers[0].id],
    log: [
      `Cycle initialized. ${map.name} seed ${seed}.`,
      `Starting factions randomized across ${playerCount} established home sectors.`,
      `${players[0].name} begins Turn 1.`,
    ],
    agreements: [],
    proposals: [],
    pendingLabor: [],
    universalClaims: [],
    spectatorMode,
    history: [],
    orderProtocol: {
      phase: "orders",
      turn: 1,
      currentPlayer: 0,
      submissions: [],
      lastResolution: [],
    },
    botReports: [],
    botMemory: [],
  };
  recordGameSnapshot(game, 0);
  return game;
}
