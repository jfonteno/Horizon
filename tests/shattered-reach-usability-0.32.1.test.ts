import test from "node:test";
import assert from "node:assert/strict";
import {
  addTradeProposal,
  createFactionAcademy,
  createGame,
  emptyTradeBundle,
  executeRoomCommand,
  getNeighbors,
  legalBombardmentTargets,
  mapLibrary,
  MemoryRoomRepository,
  projectedOrderBudget,
  resolveProposal,
  resolveShatteredOrders,
  RoomService,
} from "../game";

test("Bombardment targets a hex and allocates damage by CU, capacity, then movement", () => {
  const game = createGame(3, ["salvo", "aegis", "spires"], "shattered-reach", "horizon-base", 32101);
  const gun = game.carriers.find((carrier) => carrier.owner === 0)!;
  gun.type = "siegeCruiser";
  gun.movesRemaining = 1;
  const targetHex = getNeighbors(gun.hex, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  game.hexes.find((hex) => hex.id === targetHex)!.revealed = true;
  game.carriers = game.carriers.filter((carrier) => carrier.owner === 0);
  game.carriers.push(
    { id: "wide-transport", owner: 1, type: "transport", hex: targetHex, cu: 2, readyTurn: 1, movesRemaining: 1 },
    { id: "small-patrol", owner: 2, type: "patrol", hex: targetHex, cu: 2, readyTurn: 1, movesRemaining: 2 },
    { id: "reserve-cruiser", owner: 2, type: "cruiser", hex: targetHex, cu: 2, readyTurn: 1, movesRemaining: 2 },
  );
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "hex-shot", kind: "bombard", carrierId: gun.id, targetHexId: targetHex, targetPlayerId: 1 } }]);
  assert.equal(game.carriers.find((carrier) => carrier.id === "small-patrol")?.cu, 0, "the lowest-capacity tied vessel takes both damage points");
  assert.equal(game.carriers.find((carrier) => carrier.id === "wide-transport")?.cu, 2, "the client-supplied player target cannot override automatic hex allocation");
  assert.deepEqual(game.bombardmentMarks.map((mark) => mark.targetPlayerId), [2]);
});

test("one Siege Tender supports only one range-two Bombardment per Turn", () => {
  const game = createFactionAcademy("salvo");
  game.academy!.stage = 2;
  const source = game.carriers.find((carrier) => carrier.owner === 0 && carrier.type === "bombardFrigate")!;
  const tender = { id: "only-tender", owner: 0, type: "siegeTender" as const, hex: source.hex, cu: 2, readyTurn: game.turn, movesRemaining: 1 };
  game.carriers = game.carriers.filter((carrier) => carrier.owner === 0);
  game.carriers.push(tender, { ...source, id: "second-gun" });
  const sourceNeighbors = getNeighbors(source.hex, mapLibrary[game.mapId]);
  const rangeTwo = game.hexes.filter((hex) => hex.kind !== "rift" && !sourceNeighbors.includes(hex.id) && hex.id !== source.hex && sourceNeighbors.some((middle) => getNeighbors(middle, mapLibrary[game.mapId]).includes(hex.id))).slice(0, 2);
  assert.equal(rangeTwo.length, 2);
  rangeTwo.forEach((hex, index) => {
    hex.revealed = true;
    const middle = sourceNeighbors.find((id) => getNeighbors(id, mapLibrary[game.mapId]).includes(hex.id))!;
    game.hexes.find((candidate) => candidate.id === middle)!.owner = 0;
    game.carriers.push({ id: `range-target-${index}`, owner: index + 1, type: "transport", hex: hex.id, cu: 3, readyTurn: game.turn, movesRemaining: 1 });
  });
  assert.equal(legalBombardmentTargets(game, 0, source.id).filter((target) => target.range === 2).length >= 2, true);
  resolveShatteredOrders(game, [
    { playerId: 0, order: { id: "first", kind: "bombard", carrierId: source.id, targetHexId: rangeTwo[0].id, targetPlayerId: 1 } },
    { playerId: 0, order: { id: "second", kind: "bombard", carrierId: "second-gun", targetHexId: rangeTwo[1].id, targetPlayerId: 2 } },
  ]);
  assert.equal(game.carriers.find((carrier) => carrier.id === "range-target-0")?.cu, 2);
  assert.equal(game.carriers.find((carrier) => carrier.id === "range-target-1")?.cu, 3);
});

test("Aegis Blockade sales require acceptance and transfer payment plus ownership", () => {
  const game = createGame(2, ["aegis", "spires"], "shattered-reach", "horizon-base", 32102);
  const hex = game.hexes.find((candidate) => candidate.owner === 0)!;
  const buyerHex = game.hexes.find((candidate) => candidate.owner === 1)!;
  game.players[0].tech.Economy = 2;
  game.agreements.push({ id: "sale-agreement", type: "trade", parties: [0, 1], startedTurn: 1 });
  game.blockades.push({ id: "sale-blockade", owner: 0, hex: hex.id, active: true, readyTurn: 1, originFaction: "aegis" });
  game.players[1].resources.currency = 5;
  const sellerCurrency = game.players[0].resources.currency;
  const price = { ...emptyTradeBundle(), currency: 2 };
  const result = addTradeProposal(game, { id: "sale", kind: "trade", from: 0, to: 1, offer: emptyTradeBundle(), request: price, blockadeId: "sale-blockade", createdTurn: 1, status: "pending" });
  assert.equal(result.ok, true);
  assert.equal(game.blockades[0].owner, 0, "the offer itself does not transfer the platform");
  assert.equal(resolveProposal(game, "sale", true, buyerHex.id).ok, true);
  assert.equal(game.blockades[0].owner, 1);
  assert.equal(game.blockades[0].hex, buyerHex.id);
  assert.equal(game.players[0].resources.currency, sellerCurrency + 2);
  assert.equal(game.players[1].resources.currency, 3);
});

test("Guild enhancement planning enforces the permanent Labor floor across the whole queue", () => {
  const game = createGame(2, ["guilds", "spires"], "shattered-reach", "horizon-base", 32103);
  const player = game.players[0];
  player.laborCap = 2;
  player.labor = 2;
  player.resources = { material: 20, currency: 20, research: 20, influence: 5 };
  const habitats = game.hexes.filter((hex) => hex.owner === 0 && hex.tier);
  const second = game.hexes.find((hex) => hex.owner === undefined && hex.kind !== "rift")!;
  second.owner = 0;
  second.tier = "Colony";
  second.centers = ["material"];
  const first = habitats[0];
  first.centers.push("research");
  first.enhancedCenterIndices = [];
  const preview = projectedOrderBudget(game, 0, [
    { id: "enhance-a", kind: "construct", habitatId: first.id, construction: { type: "enhanceCenter", centerIndex: 0 } },
    { id: "enhance-b", kind: "construct", habitatId: second.id, construction: { type: "enhanceCenter", centerIndex: 0 } },
  ]);
  assert.match(preview.error || "", /Permanent Labor Capacity cannot fall below 1/);
});

test("hidden Academy guidance can be restored without restarting the exercise", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let session = await service.create(createFactionAcademy("aegis"), "Learner", "local");
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "dismissAcademy" } })).session!;
  assert.equal(session.game.academy?.dismissed, true);
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "showAcademy" } })).session!;
  assert.equal(session.game.academy?.dismissed, false);
  assert.equal(session.game.academy?.stage, 0);
});
