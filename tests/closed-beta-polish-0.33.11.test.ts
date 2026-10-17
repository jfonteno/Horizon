import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  beginSecretOrders,
  buildColonyShip,
  createGame,
  drawHiddenChoices,
  emptyTradeBundle,
  getNeighbors,
  mapLibrary,
  MemoryRoomRepository,
  resolveSecretOrders,
  RoomService,
  selectHiddenLegacy,
  submitSecretOrders,
  validateRoomCommand,
} from "../game";
import type { GameState, SecretOrder } from "../game";

function preparedGame() {
  const game = createGame(2, ["foundry", "helix"], "shattered-reach", "horizon-base", 331101);
  for (const player of game.players) {
    player.resources = { material: 40, currency: 40, research: 40, influence: 40 };
    player.labor = player.laborCap = 20;
    drawHiddenChoices(game, player.id, game.era);
    selectHiddenLegacy(game, player.id, player.hiddenLegacy[game.era].choices[0]);
  }
  return game;
}

function openNeighbor(game: GameState, origin: string, excluded = new Set<string>()) {
  const id = getNeighbors(origin, mapLibrary[game.mapId]).find((candidate) => {
    const hex = game.hexes.find((entry) => entry.id === candidate);
    return hex && !excluded.has(candidate) && hex.kind !== "rift" && hex.owner === undefined;
  });
  assert.ok(id);
  const hex = game.hexes.find((entry) => entry.id === id)!;
  hex.revealed = true;
  hex.kind = "material";
  return hex;
}

test("Blockade sale command accepts a resource bundle while scalar survey prices remain integer validated", () => {
  const price = { ...emptyTradeBundle(), material: 1, labor: 1 };
  const command = validateRoomCommand({ kind: "proposeBlockadeSale", buyer: 1, blockadeId: "blockade-0-1", price });
  if (command.kind !== "proposeBlockadeSale") throw new Error("Expected a Blockade sale command.");
  assert.deepEqual(command.price, price);
  assert.throws(() => validateRoomCommand({ kind: "surveyExchange", buyerId: 1, hexId: "2-2", price: 1.5 }), /non-negative integer/);
});

test("a Habitat Module constructed this Turn can support a second Establish Order", () => {
  const game = preparedGame(), player = game.players[0], home = player.colonyShips[0].hex;
  const first = openNeighbor(game, home);
  const second = openNeighbor(game, first.id, new Set([home, first.id]));
  assert.equal(buildColonyShip(game, 0, home).ok, true);
  player.colonyShips[0].hex = first.id;
  player.colonyShips[1].hex = second.id;
  player.colonyShips[1].readyTurn = game.turn;
  player.modules = 1;
  const orders: SecretOrder[] = [
    { id: "module", kind: "construct", habitatId: home, construction: { type: "module" } },
    { id: "first", kind: "establish", vesselId: player.colonyShips[0].id, hexId: first.id },
    { id: "second", kind: "establish", vesselId: player.colonyShips[1].id, hexId: second.id },
  ];
  beginSecretOrders(game);
  assert.equal(submitSecretOrders(game, 0, orders).ok, true);
  assert.equal(submitSecretOrders(game, 1, []).ok, true);
  assert.equal(resolveSecretOrders(game).ok, true);
  assert.equal(first.owner, 0);
  assert.equal(second.owner, 0);
  assert.equal(player.modules, 0);
});

test("multiple Establish Orders report the exact Module shortage before sealing", () => {
  const game = preparedGame(), player = game.players[0];
  assert.equal(buildColonyShip(game, 0, player.colonyShips[0].hex).ok, true);
  player.colonyShips[1].readyTurn = game.turn;
  beginSecretOrders(game);
  const result = submitSecretOrders(game, 0, player.colonyShips.map((ship, index) => ({
    id: `establish-${index}`,
    kind: "establish" as const,
    vesselId: ship.id,
    hexId: ship.hex,
  })));
  assert.equal(result.ok, false);
  assert.match(result.message, /planned 2 Establish Orders but only 1 Habitat Module is available/);
});

test("room names are canonical with an invitation-code fallback", async () => {
  const service = new RoomService(new MemoryRoomRepository());
  const named = await service.create(preparedGame(), "Host", "local", null, "horizon", false, "  Reach Council  ");
  assert.equal(named.summary.name, "Reach Council");
  const fallback = await service.create(preparedGame(), "Host", "local");
  assert.equal(fallback.summary.name, fallback.code);
});

test("home navigation consolidates campaigns into My Games with active and previous sections", async () => {
  const shell = await readFile(new URL("../app/components/ApplicationShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /<b>My Games<\/b>/);
  assert.match(shell, /<h3>Active games/);
  assert.match(shell, /<summary>Completed games/);
  assert.doesNotMatch(shell, /<b>Continue Game<\/b>/);
});
