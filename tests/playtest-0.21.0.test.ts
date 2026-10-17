import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame, projectedOrderBudget, submitSecretOrders, resolveSecretOrders,
  beginFleetTurn, buildCarrier, transferCombatUnit, resolveProposal,
  technologyExchangeCost, scoreHiddenEra, finalizeGame, projectPrivateGame,
  projectSpectatorGame, createGameSnapshot, MemoryRoomRepository, RoomService,
  executeRoomCommand, totalOrderCost, economicSalvage, type SecretOrder,
} from "../game/index";
import { hexProduction } from "../game/rules/hex-production";

function fixture() {
  const game = createGame(4, ["helix", "varkesh", "foundry", "farbound"], "standard-board", "horizon-base", 21000);
  for (const player of game.players) {
    player.resources = { material: 40, currency: 40, research: 40, influence: 40 };
    player.labor = 40;
    player.hiddenLegacy[1] = { choices: ["h1-frontier"], selected: "h1-frontier" };
  }
  return game;
}

test("multiple builds share one budget and all resolve at the same Habitat", () => {
  const game = fixture(), home = game.hexes.find((hex) => hex.owner === 0)!;
  const orders: SecretOrder[] = [
    { id: "a", kind: "construct", habitatId: home.id, construction: { type: "carrier", carrier: "patrol" } },
    { id: "b", kind: "construct", habitatId: home.id, construction: { type: "carrier", carrier: "patrol" } },
    { id: "c", kind: "construct", habitatId: home.id, construction: { type: "recruit", pairs: 2 } },
  ];
  assert.equal(projectedOrderBudget(game, 0, orders).error, undefined);
  const before = game.carriers.filter((vessel) => vessel.owner === 0).length;
  assert.equal(submitSecretOrders(game, 0, orders).ok, true);
  for (let id = 1; id < 4; id++) assert.equal(submitSecretOrders(game, id, []).ok, true);
  assert.equal(resolveSecretOrders(game).ok, true);
  assert.equal(game.carriers.filter((vessel) => vessel.owner === 0).length, before + 2);
  assert.equal(game.players[0].resources.currency, 36);
});

test("sequential construction enforces Center capacity and prices tier upgrades correctly", () => {
  const game = fixture(), home = game.hexes.find((hex) => hex.owner === 0)!;
  home.tier = "Outpost"; home.centers = [];
  game.players[0].tech.Resource = 3;
  const orders: SecretOrder[] = [
    { id: "u1", kind: "construct", habitatId: home.id, construction: { type: "upgrade" } },
    { id: "u2", kind: "construct", habitatId: home.id, construction: { type: "upgrade" } },
  ];
  assert.equal(projectedOrderBudget(game, 0, orders).error, undefined);
  assert.deepEqual(totalOrderCost(game, 0, orders), { material: 5, currency: 5, labor: 5 });
  for (let index = 0; index < 4; index++) orders.push({ id: `center-${index}`, kind: "construct", habitatId: home.id, construction: { type: "center", center: "material" } });
  assert.match(projectedOrderBudget(game, 0, orders).error || "", /Center slots/);
});

test("new uncrewed vessels remain available and become movable when crewed", () => {
  const game = fixture(), home = game.hexes.find((hex) => hex.owner === 0)!;
  home.combat = 0;
  assert.equal(buildCarrier(game, 0, home.id, "patrol").ok, true);
  const vessel = game.carriers.at(-1)!;
  game.turn = 2;
  beginFleetTurn(game, 0);
  assert.ok(game.carriers.some((candidate) => candidate.id === vessel.id));
  assert.equal(vessel.movesRemaining, 0);
  home.combat = 2;
  assert.equal(transferCombatUnit(game, 0, vessel.id, "load").ok, true);
  assert.equal(vessel.cu, 1);
  assert.equal(vessel.movesRemaining, 2);
});

test("Economic Salvage preserves unrelated docked uncrewed vessels", () => {
  const game = fixture(), home = game.hexes.find((hex) => hex.owner === 0)!;
  game.players[0].faction = "meridian";
  game.players[0].tech.Economy = 3;
  for (const hex of game.hexes.filter((hex) => hex.owner === 0)) hex.combat = 0;
  game.carriers = game.carriers.filter((vessel) => vessel.owner !== 0);
  assert.equal(buildCarrier(game, 0, home.id, "patrol").ok, true);
  const docked = game.carriers.at(-1)!;
  assert.equal(buildCarrier(game, 0, home.id, "patrol").ok, true);
  const crewed = game.carriers.at(-1)!;
  crewed.cu = 4;
  assert.equal(economicSalvage(game, 0).ok, true);
  assert.ok(game.carriers.some((vessel) => vessel.id === docked.id));
  assert.ok(!game.carriers.some((vessel) => vessel.id === crewed.id));
});

test("Technology Exchange rejects an unaffordable combined cost without spending", () => {
  const game = fixture(), buyer = game.players[1];
  game.players[0].tech.Economy = 4;
  game.players[0].tech.Exploration = 2;
  buyer.resources.currency = 2;
  game.proposals.push({ id: "exchange", kind: "technology", seller: 0, buyer: 1, branch: "Exploration", level: 2, compensation: { currency: 1, material: 0, research: 0 }, createdTurn: 1, status: "pending" });
  const before = structuredClone(buyer);
  assert.equal(technologyExchangeCost(game, 1, "Exploration", 2, { currency: 1, material: 0, research: 0 }).currency, 3);
  assert.equal(resolveProposal(game, "exchange", true).ok, false);
  assert.deepEqual(buyer, before);
  buyer.resources.currency = 3;
  assert.equal(resolveProposal(game, "exchange", true).ok, true);
  assert.equal(buyer.resources.currency, 0);
  assert.equal(buyer.tech.Exploration, 2);
});

test("Hidden points stay banked and private until final scoring, then count exactly once", () => {
  const game = fixture(), player = game.players[0];
  player.legacyMetrics.habitatsEstablished[0] = 2;
  scoreHiddenEra(game, 1);
  assert.equal(player.hiddenLegacy[1].bankedPoints, 4);
  assert.equal(player.legacy.hidden, 0);
  assert.deepEqual(projectPrivateGame(game, 1).players[0].hiddenLegacy, {});
  assert.deepEqual(projectSpectatorGame(game).players[0].hiddenLegacy, {});
  assert.ok(!game.log.some((entry) => entry.includes("Frontier")));
  game.turn = 16; game.era = 4;
  finalizeGame(game);
  assert.equal(player.legacy.hidden, 4);
  finalizeGame(game);
  assert.equal(player.legacy.hidden, 4);
  assert.equal(projectPrivateGame(game, 1).players[0].hiddenLegacy[1].completed, true);
});

test("legacy rooms retain Era-end Hidden scoring", () => {
  const game = fixture();
  delete game.secretHiddenScoring;
  game.players[0].legacyMetrics.habitatsEstablished[0] = 2;
  scoreHiddenEra(game, 1);
  assert.equal(game.players[0].legacy.hidden, 4);
});

test("final history includes Hidden scoring and cumulative trades even without proposal history", () => {
  const game = fixture();
  game.turn = 16; game.era = 4; game.orderProtocol.turn = 16;
  game.players[0].hiddenLegacy[1] = { choices: ["h1-frontier"], selected: "h1-frontier", completed: true, scored: true, bankedPoints: 4 };
  game.players[0].legacyMetrics.directTradeCount = 7;
  game.orderProtocol.phase = "ready";
  game.orderProtocol.submissions = game.players.map((player) => ({ playerId: player.id, turn: 16, sealedAt: "test", orders: [{ id: `hold-${player.id}`, kind: "hold" }] }));
  assert.equal(resolveSecretOrders(game).ok, true);
  assert.equal(game.history.at(-1)?.players[0].lp, game.players[0].lp);
  assert.equal(createGameSnapshot(game, 16).players[0].trades, 7);
});

test("production readout includes Centers and Resource IV doubling", () => {
  const game = fixture(), home = game.hexes.find((hex) => hex.owner === 0)!;
  home.centers = ["material", "research", "labor"];
  game.players[0].tech.Resource = 4;
  assert.match(hexProduction(game, home), /4 research per Turn/);
  assert.match(hexProduction(game, home), /2 material per Turn/);
  assert.match(hexProduction(game, home), /2 Labor Capacity/);
});

test("a non-host may seal first and unseal only their own current Orders", async () => {
  const repository = new MemoryRoomRepository(), service = new RoomService(repository);
  const host = await service.create(fixture(), "Host", "network");
  const room = (await repository.get(host.code))!;
  room.status = "active";
  await repository.put(room);
  const guest = await service.join(host.code, 1, "Guest");
  const sealed = await executeRoomCommand(repository, { code: host.code, token: guest.token, expectedRevision: guest.revision, command: { kind: "submitOrders", orders: [] } });
  assert.equal(sealed.ok, true, sealed.message);
  const unsealed = await executeRoomCommand(repository, { code: host.code, token: guest.token, expectedRevision: sealed.session!.revision, command: { kind: "unsealOrders" } });
  assert.equal(unsealed.ok, true);
  assert.equal(unsealed.session!.game.orderProtocol.submissions.length, 0);
  const again = await executeRoomCommand(repository, { code: host.code, token: guest.token, expectedRevision: unsealed.session!.revision, command: { kind: "unsealOrders" } });
  assert.equal(again.ok, false);
});

test("Gate contributions retain public Turn receipts", () => {
  const game = fixture();
  assert.equal(submitSecretOrders(game, 0, [{ id: "gate", kind: "tribute" }]).ok, true);
  for (let id = 1; id < 4; id++) submitSecretOrders(game, id, []);
  resolveSecretOrders(game);
  assert.equal(game.gateLedger?.length, 1);
  assert.equal(game.gateLedger?.[0].playerId, 0);
  assert.equal(game.gateLedger?.[0].turn, 1);
  assert.deepEqual(projectSpectatorGame(game).gateLedger, game.gateLedger);
});
