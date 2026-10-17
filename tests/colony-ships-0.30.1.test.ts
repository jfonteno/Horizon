import assert from "node:assert/strict";
import test from "node:test";
import {
  beginColonyTurn, beginSecretOrders, buildColonyShip, colonyShipDefinition,
  constructionQuote, createFirstHorizon, createGame, drawHiddenChoices,
  getNeighbors, loadGame, mapLibrary, MemoryRoomRepository, moveColonyShip,
  normalizeStoredRoom, planBotTurn, projectedOrderBudget, resolveSecretOrders,
  resolveSimultaneousCarrierMoves, RoomService, selectHiddenLegacy,
  submitSecretOrders,
} from "../game/index";
import { getBotProfile } from "../bots";
import { SAVE_KEY } from "../game/engine/save-game";
import type { GameState, PlayerState, SecretOrder } from "../game/index";

function fixture() {
  const game = createGame(2, ["foundry", "helix"], "shattered-reach", "horizon-base", 30101);
  for (const player of game.players) {
    player.resources = { material: 40, currency: 40, research: 40, influence: 40 };
    player.labor = player.laborCap = 20;
    drawHiddenChoices(game, player.id, 1);
    selectHiddenLegacy(game, player.id, player.hiddenLegacy[1].choices[0]);
  }
  return game;
}

function neighbor(game: GameState, origin: string) {
  const id = getNeighbors(origin, mapLibrary[game.mapId]).find((candidate) =>
    game.hexes.some((hex) => hex.id === candidate && hex.kind !== "rift" && hex.owner === undefined));
  assert.ok(id);
  const hex = game.hexes.find((candidate) => candidate.id === id)!;
  hex.revealed = true;
  hex.kind = "material";
  return hex;
}

function resolve(game: GameState, orders: SecretOrder[][]) {
  beginSecretOrders(game);
  for (const player of game.players) {
    const result = submitSecretOrders(game, player.id, orders[player.id] || []);
    assert.equal(result.ok, true, result.message);
  }
  assert.equal(resolveSecretOrders(game).ok, true);
}

test("Colony Ships are repeatable construction with a separate shared budget and next-Turn readiness", () => {
  const game = fixture(), player = game.players[0], home = player.colonyShips[0].hex;
  const original = structuredClone(player.colonyShips[0]);
  assert.deepEqual(constructionQuote(game, 0, home, { type: "colony" }).cost, colonyShipDefinition.cost);
  const orders: SecretOrder[] = [0, 1].map((index) => ({ id: `build-${index}`, kind: "construct", habitatId: home, construction: { type: "colony" } }));
  assert.equal(projectedOrderBudget(game, 0, orders).error, undefined);
  player.resources.material = 3;
  assert.match(projectedOrderBudget(game, 0, orders).error || "", /insufficient/);
  player.resources.material = 40;
  const before = structuredClone(player.resources);
  assert.equal(buildColonyShip(game, 0, home).ok, true);
  assert.equal(buildColonyShip(game, 0, home).ok, true);
  assert.equal(player.colonyShips.length, 3);
  assert.equal(new Set(player.colonyShips.map((ship) => ship.id)).size, 3);
  assert.deepEqual(player.colonyShips[0], original);
  assert.equal(player.resources.material, before.material - 4);
  assert.equal(player.resources.currency, before.currency - 4);
  assert.equal(player.modules, 1, "new hulls do not grant free Habitat Modules");
  const ship = player.colonyShips[1], target = neighbor(game, home);
  assert.equal(moveColonyShip(game, 0, ship.id, target.id).ok, false);
  game.turn++;
  beginColonyTurn(game, 0);
  assert.equal(moveColonyShip(game, 0, ship.id, target.id).ok, true);
  assert.equal(player.colonyShips[0].hex, home);
  assert.equal(player.colonyShip, home);
  assert.equal(ship.movesRemaining, 0);
  assert.equal(moveColonyShip(game, 0, ship.id, home).ok, false);
});

test("multiple Colony Ships move independently and replays retain individual identities", () => {
  const game = fixture(), player = game.players[0], home = player.colonyShips[0].hex;
  buildColonyShip(game, 0, home);
  player.colonyShips[1].readyTurn = 1;
  beginColonyTurn(game, 0);
  const target = neighbor(game, home);
  resolve(game, [[...player.colonyShips.map((ship, index): SecretOrder => ({ id: `move-${index}`, kind: "colonyMove", vesselId: ship.id, destination: target.id }))], []]);
  assert.ok(player.colonyShips.every((ship) => ship.hex === target.id));
  assert.equal(game.turnReplays?.[0].movements.filter((move) => move.unitKind === "colony").length, 2);
});

test("Colony Ships reject duplicate aliases, unavailable ships, foreign IDs, and insufficient Modules", () => {
  const game = fixture(), player = game.players[0], home = player.colonyShips[0].hex;
  const ship = player.colonyShips[0], target = neighbor(game, home);
  const duplicate = submitSecretOrders(game, 0, [
    { id: "legacy", kind: "colonyMove", destination: target.id },
    { id: "explicit", kind: "establish", vesselId: ship.id, hexId: home },
  ]);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /one Order/);
  assert.equal(submitSecretOrders(game, 0, [{ id: "foreign", kind: "colonyMove", vesselId: game.players[1].colonyShips[0].id, destination: target.id }]).ok, false);
  assert.equal(moveColonyShip(game, 0, "missing", target.id).ok, false);
  assert.equal(ship.hex, home);
  buildColonyShip(game, 0, home);
  assert.equal(submitSecretOrders(game, 0, [{ id: "unready", kind: "establish", vesselId: player.colonyShips[1].id, hexId: home }]).ok, false);
  player.colonyShips[1].readyTurn = 1;
  assert.equal(submitSecretOrders(game, 0, player.colonyShips.map((unit): SecretOrder => ({ id: unit.id, kind: "establish", vesselId: unit.id, hexId: home }))).ok, false);
});

test("multiple Colony Ships establish independent Habitats and remain reusable", () => {
  const game = fixture(), player = game.players[0], home = player.colonyShips[0].hex;
  const first = neighbor(game, home);
  const second = neighbor(game, first.id);
  buildColonyShip(game, 0, home);
  player.colonyShips[0].hex = first.id;
  player.colonyShips[1].hex = second.id;
  player.colonyShips[1].readyTurn = 1;
  player.modules = 2;
  resolve(game, [player.colonyShips.map((ship): SecretOrder => ({ id: `settle-${ship.id}`, kind: "establish", vesselId: ship.id, hexId: ship.hex })), []]);
  assert.equal(first.owner, 0);
  assert.equal(second.owner, 0);
  assert.equal(player.modules, 0);
  assert.equal(player.colonyShips.length, 2);
});

test("ordinary fleet combat cannot destroy or capture Colony Ships, including First Horizon", () => {
  for (const game of [fixture(), createFirstHorizon()]) {
    const player = game.players[0], ship = player.colonyShips[0];
    const target = neighbor(game, ship.hex);
    ship.hex = target.id;
    player.colonyShip = target.id;
    const attacker = game.carriers.find((carrier) => carrier.owner === 1)!;
    const origin = getNeighbors(target.id, mapLibrary[game.mapId]).find((id) => id !== target.id && game.hexes.some((hex) => hex.id === id && hex.kind !== "rift"))!;
    game.hexes.find((hex) => hex.id === origin)!.revealed = true;
    attacker.hex = origin;
    attacker.cu = 4;
    attacker.movesRemaining = 1;
    resolveSimultaneousCarrierMoves(game, [{ playerId: 1, carrierIds: [attacker.id], destination: target.id }]);
    assert.ok(game.players[0].colonyShips.some((unit) => unit.id === ship.id && unit.hex === target.id && unit.owner === 0));
    assert.equal(player.colonyShip, target.id);
    assert.ok(!game.log.some((line) => /Colony Ship was destroyed/.test(line)));
  }
});

test("an occupying enemy can capture a newly established Habitat without harming its Colony Ship", () => {
  const game = fixture(), player = game.players[0], ship = player.colonyShips[0];
  const target = neighbor(game, ship.hex);
  ship.hex = target.id;
  const attacker = game.carriers.find((carrier) => carrier.owner === 1)!;
  attacker.hex = target.id;
  attacker.cu = 4;
  resolve(game, [[{ id: "settle", kind: "establish", vesselId: ship.id, hexId: target.id }], []]);
  assert.equal(target.owner, 1);
  assert.equal(ship.owner, 0);
  assert.equal(ship.hex, target.id);
  assert.equal(player.colonyShips.length, 1);
});

test("bots can issue separate establishment Orders for multiple Colony Ships", () => {
  const game = fixture(), player = game.players[0];
  const first = neighbor(game, player.colonyShips[0].hex), second = neighbor(game, first.id);
  buildColonyShip(game, 0, player.colonyShips[0].hex);
  player.colonyShips[0].hex = first.id;
  player.colonyShips[1].hex = second.id;
  player.colonyShips[1].readyTurn = 1;
  beginColonyTurn(game, 0);
  player.modules = 2;
  game.gate = 6;
  const profile = getBotProfile("meta-analyst")!;
  const plan = planBotTurn(game, 0, profile);
  const established = plan.orders.filter((order) => order.kind === "establish");
  assert.equal(established.length, 2);
  assert.equal(new Set(established.map((order) => order.vesselId)).size, 2);
});

test("room migration preserves old Colony Ship locations and enables replacements for destroyed hulls", async () => {
  const service = new RoomService(new MemoryRoomRepository());
  const host = await service.create(fixture(), "Host", "local");
  const stored = await service.getStoredRoom(host.code);
  for (const player of stored.game.players) delete (player as Partial<PlayerState>).colonyShips;
  stored.game.schemaVersion = 17;
  stored.game.players[1].colonyShip = "";
  const migrated = normalizeStoredRoom(stored);
  assert.equal(migrated.game.schemaVersion, 21);
  assert.equal(migrated.game.players[0].colonyShips[0].hex, migrated.game.players[0].colonyShip);
  assert.equal(migrated.game.players[1].colonyShips.length, 0);
  const home = migrated.game.hexes.find((hex) => hex.owner === 1 && hex.tier)!;
  assert.equal(buildColonyShip(migrated.game, 1, home.id).ok, true);
  assert.equal(migrated.game.players[1].colonyShips.length, 1);
  assert.equal(normalizeStoredRoom(migrated).game.players[1].colonyShips.length, 1);
});

test("local saves migrate legacy ships without recreating an explicitly empty fleet", (context) => {
  const game = fixture();
  for (const player of game.players) delete (player as Partial<PlayerState>).colonyShips;
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let payload = JSON.stringify(game);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => key === SAVE_KEY ? payload : null } });
  context.after(() => original ? Object.defineProperty(globalThis, "localStorage", original) : Reflect.deleteProperty(globalThis, "localStorage"));
  const loaded = loadGame()!;
  assert.equal(loaded.players[0].colonyShips[0].hex, game.players[0].colonyShip);
  loaded.players[0].colonyShips = [];
  payload = JSON.stringify(loaded);
  const reloaded = loadGame()!;
  assert.deepEqual(reloaded.players[0].colonyShips, []);
  assert.equal(reloaded.players[0].colonyShip, "");
});
