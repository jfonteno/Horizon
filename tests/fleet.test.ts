import assert from "node:assert/strict";
import test from "node:test";
import {
  beginFleetTurn,
  buildCarrier,
  carrierCost,
  createGame,
  getNeighbors,
  mapLibrary,
  moveCarriers,
  removeCapturedCenter,
  recruitCombatUnits,
} from "../game/index";

function fleetGame() {
  const game = createGame(2, ["varkesh", "helix"], "shattered-reach", "horizon-base", 5050);
  game.players.forEach(player => { player.resources = { material: 30, currency: 30, research: 30, influence: 30 }; player.labor = 20; player.laborCap = 20; });
  return game;
}

function adjacentOpen(game: ReturnType<typeof fleetGame>, origin: string) {
  const id = getNeighbors(origin, mapLibrary[game.mapId]).find(candidate => game.hexes.find(hex => hex.id === candidate)?.kind !== "rift");
  assert.ok(id);
  game.hexes.find(hex => hex.id === id)!.revealed = true;
  return id;
}

test("Varkesh carrier discount and one Construction Order are enforced", () => {
  const game = fleetGame();
  const home = mapLibrary[game.mapId].starts[0];
  game.players[0].tech.Military = 2;
  assert.deepEqual(carrierCost(game.players[0], "frigate"), { material: 1, currency: 2, labor: 1 });
  assert.equal(buildCarrier(game, 0, home, "frigate").ok, true);
  assert.equal(buildCarrier(game, 0, home, "corvette").ok, false);
  const frigate = game.carriers.find(carrier => carrier.type === "frigate")!;
  assert.equal(frigate.readyTurn, 2);
  assert.equal(frigate.cu, 0);
  game.turn = 2;
  beginFleetTurn(game, 0);
  assert.equal(frigate.cu, 1, "new vessel automatically loads a stationed CU when it activates");
  assert.equal(frigate.movesRemaining, 2);
});

test("recruited CU arrive next Turn", () => {
  const game = fleetGame();
  const home = mapLibrary[game.mapId].starts[0];
  assert.equal(recruitCombatUnits(game, 0, home, 2).ok, true);
  assert.equal(game.hexes.find(hex => hex.id === home)!.combat, 2);
  game.turn = 2;
  beginFleetTurn(game, 0);
  assert.equal(game.hexes.find(hex => hex.id === home)!.combat, 6);
});

test("stronger task force survives with subtraction casualties", () => {
  const game = fleetGame();
  const attacker = game.carriers.find(carrier => carrier.owner === 0)!;
  const destination = adjacentOpen(game, attacker.hex);
  attacker.type = "transport"; attacker.cu = 4; attacker.movesRemaining = 1;
  const defender = game.carriers.find(carrier => carrier.owner === 1)!;
  defender.hex = destination; defender.cu = 2;
  assert.equal(moveCarriers(game, 0, [attacker.id], destination).ok, true);
  assert.equal(game.carriers.some(carrier => carrier.id === defender.id), false);
  assert.equal(game.carriers.find(carrier => carrier.id === attacker.id)?.cu, 2);
});

test("equal fleet strength causes mutual destruction", () => {
  const game = fleetGame();
  const attacker = game.carriers.find(carrier => carrier.owner === 0)!;
  const destination = adjacentOpen(game, attacker.hex);
  attacker.cu = 2; attacker.movesRemaining = 1;
  const defender = game.carriers.find(carrier => carrier.owner === 1)!;
  defender.hex = destination; defender.cu = 2;
  assert.equal(moveCarriers(game, 0, [attacker.id], destination).ok, true);
  assert.equal(game.carriers.some(carrier => carrier.id === attacker.id || carrier.id === defender.id), false);
});

test("Assault Vessel reduces Home Guard and Varkesh capture preserves tier", () => {
  const game = fleetGame();
  const attacker = game.carriers.find(carrier => carrier.owner === 0)!;
  const destination = adjacentOpen(game, attacker.hex);
  attacker.type = "assault"; attacker.cu = 3; attacker.movesRemaining = 1;
  const target = game.hexes.find(hex => hex.id === destination)!;
  target.owner = 1; target.tier = "Metropolis"; target.combat = 2; target.centers = ["currency", "research", "material"];
  game.carriers.find(carrier => carrier.owner === 1)!.hex = mapLibrary[game.mapId].starts[1];
  assert.equal(moveCarriers(game, 0, [attacker.id], destination).ok, true);
  assert.equal(target.owner, 0);
  assert.equal(target.tier, "Metropolis");
  assert.equal(attacker.cu, 1);
  assert.equal(game.players[0].lp, 1);
});

test("Non-Aggression Pact blocks hostile fleet movement", () => {
  const game = fleetGame();
  const attacker = game.carriers.find(carrier => carrier.owner === 0)!;
  const destination = adjacentOpen(game, attacker.hex);
  game.carriers.find(carrier => carrier.owner === 1)!.hex = destination;
  game.agreements.push({ id: "nap", type: "nonAggression", parties: [0, 1], startedTurn: 1 });
  assert.equal(moveCarriers(game, 0, [attacker.id], destination).ok, false);
  assert.equal(attacker.hex, mapLibrary[game.mapId].starts[0]);
});

test("capturing player chooses excess Centers after tier loss", () => {
  const game = createGame(2, ["helix", "varkesh"], "shattered-reach", "horizon-base", 5051);
  const attacker = game.carriers.find(carrier => carrier.owner === 0)!;
  const destination = adjacentOpen(game, attacker.hex);
  attacker.type = "transport"; attacker.cu = 5; attacker.movesRemaining = 1;
  const target = game.hexes.find(hex => hex.id === destination)!;
  target.owner = 1; target.tier = "Metropolis"; target.combat = 1; target.centers = ["currency", "research", "defense"];
  game.carriers.find(carrier => carrier.owner === 1)!.hex = mapLibrary[game.mapId].starts[1];
  assert.equal(moveCarriers(game, 0, [attacker.id], destination).ok, true);
  assert.equal(target.tier, "Colony");
  assert.equal(game.pendingCenterLoss?.removeCount, 1);
  assert.equal(removeCapturedCenter(game, 0, 2).ok, true);
  assert.deepEqual(target.centers, ["currency", "research"]);
  assert.equal(game.pendingCenterLoss, undefined);
});
