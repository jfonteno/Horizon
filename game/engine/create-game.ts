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
  const map = mapLibrary[mapId],
    random = seededRandom(seed),
    openCount = map.rows * map.columns - map.blocked.size - map.starts.length;
  const pool = [...map.tilePool];
  while (pool.length < openCount) pool.push("empty");
  const mixed = shuffle(pool, random);
  let position = 0;
  const hexes: HexState[] = [];
  for (let row = 0; row < map.rows; row++)
    for (let col = 0; col < map.columns; col++) {
      const id = `${row}-${col}`,
        start = map.starts.slice(0, playerCount).indexOf(id);
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
      explorer: map.starts[id],
      colonyShip: map.starts[id],
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
    definition.initialize(player);
    if (faction === "foundry")
      hexes.find((hex) => hex.id === map.starts[id])!.centers.push("material");
    return player;
  });
  const carriers: CarrierState[] = players.map((player) => ({
    id: `carrier-${player.id}-1`,
    owner: player.id,
    type: "patrol",
    hex: map.starts[player.id],
    cu: 2,
    readyTurn: 1,
    movesRemaining: 2,
  }));
  const game: GameState = {
    schemaVersion: 13,
    mapId,
    themeId,
    seed,
    players,
    hexes,
    active: 0,
    turn: 1,
    era: 1,
    gate: 0,
    selected: map.starts[0],
    mode: "inspect",
    moves: { explorer: 1, colony: 1 },
    carriers,
    civilianUnits: [],
    selectedCarrierIds: [carriers[0].id],
    log: [
      `Cycle initialized. ${map.name} seed ${seed}.`,
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
