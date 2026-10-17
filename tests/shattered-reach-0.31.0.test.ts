import test from "node:test";
import assert from "node:assert/strict";
import {
  activeAgreements,
  constructionQuote,
  createGame,
  factionLibrary,
  getNeighbors,
  homeGuardStrength,
  mapLibrary,
  recordGunForHire,
  resolveShatteredConstruction,
  resolveShatteredOrders,
} from "../game";

const expansion = ["spires", "aegis", "wayfarers", "salvo", "guilds"] as const;

test("Shattered Reach factions retain artwork and their established objective chains", () => {
  for (const id of expansion) {
    const faction = factionLibrary[id];
    assert.ok(faction);
    assert.equal(faction.sourcePackVersion, "0.33.3");
    assert.ok(faction.objectives.length >= 5);
    assert.equal(faction.logo, `/factions/${id}.png`);
  }
});

test("Spires receive discounted urban upgrades and can construct an Arcology", () => {
  const game = createGame(2, ["spires", "aegis"], "shattered-reach", "horizon-base", 31001);
  const player = game.players[0], home = game.hexes.find((hex) => hex.owner === 0)!;
  home.tier = "Metropolis";
  player.tech.Resource = 4;
  player.resources.material = 10;
  player.resources.currency = 10;
  player.labor = 10;
  const quote = constructionQuote(game, 0, home.id, { type: "arcology" });
  assert.equal(quote.available, true);
  assert.deepEqual(quote.cost, { material: 4, currency: 3, labor: 3 });
  assert.equal(resolveShatteredConstruction(game, 0, home.id, { type: "arcology" }), true);
  assert.equal(home.tier, "Arcology");
  assert.equal(home.arcologyOrigin, "spires");
  const nonSpires = createGame(2, ["aegis", "spires"], "shattered-reach", "horizon-base", 31011);
  const aegisHome = nonSpires.hexes.find((hex) => hex.owner === 0)!;
  aegisHome.tier = "Metropolis";
  nonSpires.players[0].tech.Resource = 4;
  const unavailable = constructionQuote(nonSpires, 0, aegisHome.id, { type: "arcology" });
  assert.equal(unavailable.available, false);
  assert.match(unavailable.reason || "", /Only the Spires/);
});

test("Wayfarers begin with an Arkship instead of a Colony Ship and failed Migration is atomic", () => {
  const game = createGame(2, ["wayfarers", "guilds"], "shattered-reach", "horizon-base", 31002);
  const player = game.players[0], mobile = game.mobileHabitats[0], origin = mobile.hex;
  assert.equal(player.colonyShips.length, 0);
  assert.equal(mobile.type, "arkship");
  const invalid = game.hexes.find((hex) => hex.id !== origin && hex.kind === "rift")!;
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "bad-migration", kind: "migration", mobileHabitatId: mobile.id, destination: invalid.id } }]);
  assert.equal(mobile.hex, origin);
  assert.equal(mobile.deployed, true);
  assert.equal(mobile.movesRemaining, 1);
  const destination = getNeighbors(origin, mapLibrary[game.mapId]).map((id) => game.hexes.find((hex) => hex.id === id)!).find((hex) => hex.kind !== "rift")!;
  destination.revealed = true;
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "migration", kind: "migration", mobileHabitatId: mobile.id, destination: destination.id } }]);
  assert.equal(mobile.hex, destination.id);
  assert.equal(mobile.deployed, true);
});

test("Salvo Bombardment cannot destroy a force's final Combat Unit", () => {
  const game = createGame(2, ["salvo", "aegis"], "shattered-reach", "horizon-base", 31003);
  const gun = game.carriers.find((carrier) => carrier.owner === 0)!;
  const targetId = getNeighbors(gun.hex, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  game.hexes.find((hex) => hex.id === targetId)!.revealed = true;
  const enemy = game.carriers.find((carrier) => carrier.owner === 1)!;
  enemy.hex = targetId;
  enemy.cu = 2;
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "shot", kind: "bombard", carrierId: gun.id, targetHexId: targetId, targetPlayerId: 1 } }]);
  assert.equal(enemy.cu, 1);
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "shot-2", kind: "bombard", carrierId: gun.id, targetHexId: targetId, targetPlayerId: 1 } }]);
  assert.equal(enemy.cu, 1);
});

test("Guilds start with one free Enhanced Center and pay the permanent Labor tradeoff", () => {
  const game = createGame(2, ["guilds", "spires"], "shattered-reach", "horizon-base", 31004);
  const player = game.players[0], home = game.hexes.find((hex) => hex.owner === 0)!;
  assert.deepEqual(home.enhancedCenterIndices, [0]);
  assert.equal(player.laborPenalty, 1);
  assert.equal(player.laborCap, 2);
  assert.equal(home.centers[0], "currency");
});

test("Aegis Grids retain their defensive effect and Blockades transfer only by explicit agreement Order", () => {
  const game = createGame(2, ["aegis", "spires"], "shattered-reach", "horizon-base", 31005);
  const home = game.hexes.find((hex) => hex.owner === 0)!;
  home.centers.push("defense");
  home.defenseGridOrigin = "aegis";
  home.owner = 1;
  assert.equal(homeGuardStrength(game, home), 5);
  game.blockades.push({ id: "platform", owner: 0, hex: home.id, active: true, readyTurn: 1, originFaction: "aegis" });
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "no-treaty", kind: "transferBlockade", blockadeId: "platform", toPlayerId: 1 } }]);
  assert.equal(game.blockades[0].owner, 0);
  game.agreements.push({ id: "trade", type: "trade", parties: [0, 1], startedTurn: 1 });
  assert.equal(activeAgreements(game).length, 1);
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "transfer", kind: "transferBlockade", blockadeId: "platform", toPlayerId: 1 } }]);
  assert.equal(game.blockades[0].owner, 1);
});

test("Gun for Hire attributes a bombarded force's later defeat to a third civilization", () => {
  const game = createGame(3, ["salvo", "aegis", "spires"], "shattered-reach", "horizon-base", 31006);
  game.bombardmentMarks.push({ turn: 1, salvoPlayerId: 0, targetPlayerId: 1, hexId: "target", damage: 1 });
  recordGunForHire(game, "target", [1], [2]);
  assert.equal(game.players[0].legacyMetrics.salvoGunForHireEvents, 1);
  assert.deepEqual(game.players[0].legacyMetrics.salvoGunForHireTargets, [1]);
});
