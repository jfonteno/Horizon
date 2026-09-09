import assert from "node:assert/strict";
import test from "node:test";
import {
  availableExplorationTypes,
  buildExplorationVessel,
  createGame,
  finalEra,
  gateTarget,
  getNeighbors,
  hiddenLegacyDeck,
  mapLibrary,
  moveExplorationVessel,
  scanWithExplorationVessel,
  totalTurns,
  universalLegacy,
} from "../game/index";

const factions = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian"] as const;

test("0.20.0 supports four-Era and five-Era formats with dynamic Gate targets", () => {
  const short = createGame(4, [...factions.slice(0, 4)], "standard-board", "horizon-base", 20001);
  const long = createGame(6, [...factions], "standard-board", "horizon-base", 20002, [], false, "five-era");
  assert.equal(short.orderProtocol.phase, "negotiation");
  assert.equal(totalTurns(short), 16);
  assert.equal(finalEra(short), 4);
  assert.equal(gateTarget(short), 12);
  assert.equal(totalTurns(long), 20);
  assert.equal(finalEra(long), 5);
  assert.equal(gateTarget(long), 24);
  assert.equal(long.players.every((player) => player.eraTributes.length === 5), true);
});

test("the hazard-free Standard Board is a side-6 hex with 91 playable hexes and symmetric setup sets", () => {
  const map = mapLibrary["standard-board"];
  assert.equal(map.rows, 11);
  assert.equal(map.columns, 11);
  assert.equal(map.rows * map.columns - map.blocked.size, 91);
  assert.deepEqual(Object.keys(map.startsByPlayerCount || {}).sort(), ["4", "5", "6"]);
  const game = createGame(6, [...factions], "standard-board", "horizon-base", 20003);
  assert.equal(game.hexes.filter((hex) => hex.kind !== "rift").length, 91);
  assert.equal(game.hexes.some((hex) => hex.kind === "hazard"), false);
  assert.equal(game.hexes.filter((hex) => hex.kind === "home").length, 6);
});

test("Exploration Technology unlocks constructible hulls, path movement, and public scanning", () => {
  const game = createGame(4, [...factions.slice(0, 4)], "standard-board", "horizon-base", 20004);
  const player = game.players[0];
  player.tech.Exploration = 4;
  player.resources = { material: 20, currency: 20, research: 0, influence: 1 };
  player.labor = 10;
  const home = game.hexes.find((hex) => hex.owner === player.id && hex.kind === "home")!;
  assert.deepEqual(availableExplorationTypes(game, player.id), ["exploration", "survey", "deepSurvey", "pathfinder"]);
  assert.equal(buildExplorationVessel(game, player.id, home.id, "pathfinder").ok, true);
  const vessel = player.explorationVessels.at(-1)!;
  vessel.readyTurn = game.turn;
  vessel.movesRemaining = 3;
  const first = getNeighbors(home.id, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  game.hexes.find((hex) => hex.id === first)!.revealed = true;
  const second = getNeighbors(first, mapLibrary[game.mapId]).find((id) => id !== home.id && game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  assert.equal(moveExplorationVessel(game, player.id, vessel.id, second, [first, second]).ok, true);
  assert.equal(vessel.hex, second);
  const scan = getNeighbors(second, mapLibrary[game.mapId]).find((id) => !game.hexes.find((hex) => hex.id === id)!.revealed && game.hexes.find((hex) => hex.id === id)!.kind !== "rift");
  if (scan) {
    vessel.movesRemaining = 1;
    assert.equal(scanWithExplorationVessel(game, player.id, vessel.id, [scan]).ok, true);
    assert.equal(game.hexes.find((hex) => hex.id === scan)!.revealed, true);
  }
});

test("five Universal and ten Hidden Legacy objectives are available for every Era", () => {
  for (let era = 1; era <= 5; era++) {
    assert.equal(universalLegacy.filter((objective) => objective.era === era).length, 5);
    assert.equal(hiddenLegacyDeck.filter((objective) => objective.era === era).length, 10);
  }
});
