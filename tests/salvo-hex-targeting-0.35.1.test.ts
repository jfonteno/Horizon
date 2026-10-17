import test from "node:test";
import assert from "node:assert/strict";
import { createGame, drawHiddenChoices, getNeighbors, mapLibrary, resolveSecretOrders, submitSecretOrders } from "../game";
import { hexDistance } from "../game/rules/diplomacy";
import { legalBombardmentTargets, resolveShatteredOrders } from "../game/rules/shattered-reach";

function prepare() {
  const game = createGame(2, ["salvo", "aegis"], "shattered-reach", "horizon-base", 35101);
  for (const player of game.players) {
    drawHiddenChoices(game, player.id, game.era);
    player.hiddenLegacy[game.era].selected = player.hiddenLegacy[game.era].choices[0];
  }
  return game;
}

test("Salvo can aim at an empty or unrevealed hex and hit a force that moves into it", () => {
  const game = prepare(), map = mapLibrary[game.mapId];
  const gun = game.carriers.find((carrier) => carrier.owner === 0 && carrier.type === "bombardFrigate")!;
  game.players[0].tech.Military = 1;
  const rival = game.carriers.find((carrier) => carrier.owner === 1)!;
  const route = getNeighbors(gun.hex, map).flatMap((destination) =>
    game.hexes.find((hex) => hex.id === destination)?.kind === "rift" ? [] :
      getNeighbors(destination, map).flatMap((target) =>
        hexDistance(gun.hex, target) > 1 && game.hexes.find((hex) => hex.id === target)?.kind !== "rift" &&
        game.hexes.find((hex) => hex.id === target)?.owner === undefined &&
        getNeighbors(target, map).some((candidate) => candidate !== destination && candidate !== gun.hex && game.hexes.find((hex) => hex.id === candidate)?.kind !== "rift")
          ? [{ destination, target }] : []))[0];
  assert.ok(route, "test needs a sector beyond the initial firing range");
  const { destination, target } = route;
  const rivalOrigin = getNeighbors(target, map).find((id) => id !== destination && id !== gun.hex && game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  game.hexes.find((hex) => hex.id === destination)!.revealed = true;
  game.hexes.find((hex) => hex.id === rivalOrigin)!.revealed = true;
  game.hexes.find((hex) => hex.id === target)!.revealed = false;
  rival.hex = rivalOrigin;
  rival.cu = 3;
  rival.movesRemaining = 1;
  assert.equal(legalBombardmentTargets(game, 0, gun.id).some((option) => option.hexId === target), false);
  assert.ok(legalBombardmentTargets(game, 0, gun.id, undefined, destination).some((option) => option.hexId === target && option.targetPlayerId === undefined));
  const shot = { id: "shot", kind: "bombard" as const, carrierId: gun.id, targetHexId: target, strength: 1 as const };
  assert.equal(submitSecretOrders(game, 0, [
    { id: "move", kind: "carrierMove", carrierIds: [gun.id], destination, path: [destination] }, shot,
  ]).ok, true);
  game.hexes.find((hex) => hex.id === target)!.revealed = true;
  assert.equal(submitSecretOrders(game, 1, [
    { id: "arrival", kind: "carrierMove", carrierIds: [rival.id], destination: target, path: [target] },
  ]).ok, true);
  assert.equal(resolveSecretOrders(game).ok, true);
  assert.equal(game.carriers.find((carrier) => carrier.id === gun.id)?.hex, destination);
  assert.equal(game.carriers.find((carrier) => carrier.id === rival.id)?.cu, 2);
  assert.equal(game.players[0].legacyMetrics.salvoBombardments, 1);
});

test("Bombarding an empty hex resolves without scoring, while an enemy Habitat's garrison can be hit", () => {
  const game = prepare(), map = mapLibrary[game.mapId];
  const gun = game.carriers.find((carrier) => carrier.owner === 0 && carrier.type === "bombardFrigate")!;
  const empty = getNeighbors(gun.hex, map).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  const beforeLP = game.players[0].lp;
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "empty", kind: "bombard", carrierId: gun.id, targetHexId: empty, strength: 1 } }]);
  assert.equal(game.bombardmentsThisTurn[0], 1);
  assert.equal(game.players[0].legacyMetrics.salvoBombardments, 0);
  assert.equal(game.players[0].lp, beforeLP);
  const habitat = game.hexes.find((hex) => hex.owner === 1)!;
  gun.hex = getNeighbors(habitat.id, map).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  habitat.combat = 3;
  game.carriers = game.carriers.filter((carrier) => carrier.owner === 0);
  game.players[0].resources.material = 10;
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "habitat", kind: "bombard", carrierId: gun.id, targetHexId: habitat.id, strength: 1 } }]);
  assert.equal(habitat.combat, 2);
  assert.equal(game.players[0].legacyMetrics.salvoBombardments, 1);
});
