import test from "node:test";
import assert from "node:assert/strict";
import {
  constructionQuote,
  createFactionAcademy,
  createGame,
  drawHiddenChoices,
  getNeighbors,
  mapLibrary,
  projectPrivateGame,
  resolveShatteredConstruction,
  resolveSimultaneousCarrierMoves,
  submitSecretOrders,
} from "../game";

function selectHiddenObjective(game: ReturnType<typeof createGame>, playerId: number) {
  drawHiddenChoices(game, playerId, game.era);
  const hidden = game.players[playerId].hiddenLegacy[game.era];
  hidden.selected = hidden.choices[0];
}

test("Farbound Exploration vessels may move and Forward Scan in the same Turn", () => {
  const game = createGame(2, ["farbound", "aegis"], "shattered-reach", "horizon-base", 32201);
  selectHiddenObjective(game, 0);
  const vessel = game.players[0].explorationVessels[0];
  const neighbors = getNeighbors(vessel.hex, mapLibrary[game.mapId]);
  const moveTarget = neighbors[0];
  const scanTarget = neighbors[1];
  game.hexes.find((hex) => hex.id === moveTarget)!.revealed = true;
  game.hexes.find((hex) => hex.id === scanTarget)!.revealed = false;
  const result = submitSecretOrders(game, 0, [
    { id: "move", kind: "explorerMove", vesselId: vessel.id, destination: moveTarget, path: [moveTarget] },
    { id: "scan", kind: "farboundForwardScan", vesselId: vessel.id, hexId: scanTarget },
  ]);
  assert.equal(result.ok, true);
});

test("Bombardment 2 conflicts with movement while Bombardment 1 may accompany it", () => {
  const game = createGame(2, ["salvo", "aegis"], "shattered-reach", "horizon-base", 32202);
  selectHiddenObjective(game, 0);
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  carrier.type = "siegeCruiser";
  carrier.cu = 2;
  carrier.movesRemaining = 1;
  const destination = getNeighbors(carrier.hex, mapLibrary[game.mapId])[0];
  game.hexes.find((hex) => hex.id === destination)!.revealed = true;
  const move = { id: "move", kind: "carrierMove" as const, carrierIds: [carrier.id], destination, path: [destination] };
  const target = getNeighbors(destination, mapLibrary[game.mapId]).find((id) => id !== carrier.hex && game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  assert.equal(submitSecretOrders(game, 0, [move, { id: "heavy", kind: "bombard", carrierId: carrier.id, targetHexId: target, targetPlayerId: 1, strength: 2 }]).ok, false);
  assert.equal(submitSecretOrders(game, 0, [move, { id: "light", kind: "bombard", carrierId: carrier.id, targetHexId: target, strength: 1 }]).ok, true);
});

test("Wayfarer mobile construction works without a permanent Habitat in the hex", () => {
  const game = createFactionAcademy("wayfarers");
  const mobile = game.mobileHabitats.find((candidate) => candidate.owner === 0)!;
  const neutral = game.hexes.find((hex) => hex.owner === undefined && hex.revealed && hex.kind !== "rift")!;
  mobile.hex = neutral.id;
  game.players[0].resources.material = 20;
  game.players[0].resources.currency = 20;
  game.players[0].labor = 20;
  game.players[0].laborCap = 20;
  const construction = { type: "mobileCenter" as const, mobileHabitatId: mobile.id, center: "material" as const };
  const before = mobile.centers.length;
  assert.equal(constructionQuote(game, 0, neutral.id, construction).available, true);
  assert.equal(resolveShatteredConstruction(game, 0, neutral.id, construction), true);
  assert.equal(mobile.centers.length, before + 1);
  assert.equal(mobile.centers.at(-1), "material");
});

test("private Farbound survey art remains visible only in that player's projection", () => {
  const game = createGame(2, ["farbound", "aegis"], "shattered-reach", "horizon-base", 32203);
  const target = game.hexes.find((hex) => !hex.revealed && hex.kind !== "rift")!;
  const actualKind = target.kind;
  game.players[0].privateSurveys.push({ hexId: target.id, kind: actualKind, surveyedTurn: game.turn, soldTo: [] });
  target.surveyedBy = [0];
  const farboundView = projectPrivateGame(game, 0).hexes.find((hex) => hex.id === target.id)!;
  const aegisView = projectPrivateGame(game, 1).hexes.find((hex) => hex.id === target.id)!;
  assert.equal(farboundView.kind, actualKind);
  assert.deepEqual(farboundView.surveyedBy, [0]);
  assert.equal(aegisView.kind, "empty");
  assert.deepEqual(aegisView.surveyedBy, []);
});

test("Open Borders bypasses a Blockade and Blockade combat never grants Glory", () => {
  const peaceful = createGame(2, ["varkesh", "aegis"], "shattered-reach", "horizon-base", 32204);
  const attacker = peaceful.carriers.find((carrier) => carrier.owner === 0)!;
  const destination = getNeighbors(attacker.hex, mapLibrary[peaceful.mapId])[0];
  peaceful.hexes.find((hex) => hex.id === destination)!.revealed = true;
  peaceful.blockades.push({ id: "open-blockade", owner: 1, hex: destination, active: true, readyTurn: 1, originFaction: "aegis" });
  peaceful.agreements.push({ id: "open", type: "openBorders", parties: [0, 1], startedTurn: 1 });
  const before = attacker.cu;
  resolveSimultaneousCarrierMoves(peaceful, [{ playerId: 0, carrierIds: [attacker.id], destination, path: [destination] }]);
  assert.equal(peaceful.carriers.find((carrier) => carrier.id === attacker.id)?.cu, before);
  assert.equal(peaceful.blockades[0].active, true);

  const hostile = createGame(2, ["varkesh", "aegis"], "shattered-reach", "horizon-base", 32205);
  const varkesh = hostile.carriers.find((carrier) => carrier.owner === 0)!;
  varkesh.type = "cruiser";
  varkesh.cu = 5;
  varkesh.movesRemaining = 2;
  const blocked = getNeighbors(varkesh.hex, mapLibrary[hostile.mapId])[0];
  hostile.hexes.find((hex) => hex.id === blocked)!.revealed = true;
  hostile.blockades.push({ id: "hostile-blockade", owner: 1, hex: blocked, active: true, readyTurn: 1, originFaction: "aegis" });
  const lp = hostile.players[0].lp;
  resolveSimultaneousCarrierMoves(hostile, [{ playerId: 0, carrierIds: [varkesh.id], destination: blocked, path: [blocked] }]);
  assert.equal(hostile.blockades[0].active, false);
  assert.equal(hostile.players[0].lp, lp);
});
