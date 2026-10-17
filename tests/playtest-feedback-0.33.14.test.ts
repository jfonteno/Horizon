import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGame, drawHiddenChoices, executeRoomCommand, MemoryRoomRepository, normalizeStoredRoom, RoomService, selectHiddenLegacy } from "../game/index";
import type { GameState } from "../game/index";
import { brokerTrade } from "../game/rules/faction-operations";
import { proposeBrokerage, respondBrokerage } from "../game/rules/brokerage-offers";
import { productionForecast } from "../game/rules/production-forecast";
import { uncommandedUnits } from "../game/rules/uncommanded-units";

test("production forecast itemizes recurring output and enhanced or Factory production", () => {
  const game = createGame(2, ["guilds", "foundry"], "shattered-reach", "horizon-base", 3314);
  const home = game.hexes.find((hex) => hex.owner === 0)!;
  home.centers.push("currency", "factory");
  home.enhancedCenterIndices = [0];
  home.factoryOutputs = { 2: "research" };
  const forecast = productionForecast(game, 0);
  assert.equal(forecast.totals.currency, 4);
  assert.equal(forecast.totals.research, 1);
  assert.equal(forecast.totals.material, 0);
  assert.ok(forecast.sources.some((source) => source.label === "currency Center"));
  assert.ok(forecast.sources.some((source) => source.label === "Factory"));
});

test("uncommanded list is advisory and excludes ordered or unready vessels", () => {
  const game = createGame(2, ["salvo", "helix"], "shattered-reach", "horizon-base", 3315);
  const carrier = game.carriers.find((unit) => unit.owner === 0)!;
  const initial = uncommandedUnits(game, 0, []);
  assert.ok(initial.some((unit) => unit.id === carrier.id));
  assert.ok(!uncommandedUnits(game, 0, [{ id: "shot", kind: "bombard", carrierId: carrier.id, targetHexId: "0-0", targetPlayerId: 1, strength: 2 }]).some((unit) => unit.id === carrier.id));
  carrier.readyTurn = game.turn + 1;
  assert.ok(!uncommandedUnits(game, 0, []).some((unit) => unit.id === carrier.id));
});

test("Brokerage reward is limited per Turn across pairs and rejects malformed bundles", () => {
  const game = createGame(4, ["meridian", "foundry", "helix", "aurelians"], "shattered-reach", "horizon-base", 3316);
  for (const player of game.players) { player.resources.material = 5; player.resources.currency = 5; }
  const a = { material: 1, currency: 0, research: 0, labor: 0 }, b = { material: 0, currency: 1, research: 0, labor: 0 };
  const before = game.players[0].resources.currency;
  assert.equal(brokerTrade(game, 0, 1, 2, a, b).ok, true);
  assert.equal(brokerTrade(game, 0, 1, 3, a, b).ok, true);
  assert.equal(game.players[0].resources.currency, before + 1);
  assert.equal(brokerTrade(game, 0, 2, 3, { ...a, material: -1 }, b).ok, false);
  assert.equal(brokerTrade(game, 0, 2, 3, { ...a, material: 0 }, b).ok, false);
});

test("brokered exchanges wait for both participants' consent before settlement", () => {
  const game = createGame(3, ["meridian", "foundry", "helix"], "shattered-reach", "horizon-base", 3317);
  for (const player of game.players) { player.resources.material = 5; player.resources.currency = 5; }
  const a = { material: 1, currency: 0, research: 0, labor: 0 };
  const b = { material: 0, currency: 1, research: 0, labor: 0 };
  const before = game.players.map((player) => ({ ...player.resources }));
  assert.equal(proposeBrokerage(game, 0, 1, 2, a, b, "consent-1").ok, true);
  assert.deepEqual(game.players.map((player) => player.resources), before);
  assert.equal(respondBrokerage(game, "consent-1", 0, true).ok, false);
  assert.equal(respondBrokerage(game, "consent-1", 1, true).ok, true);
  assert.deepEqual(game.players.map((player) => player.resources), before);
  assert.equal(respondBrokerage(game, "consent-1", 2, true).ok, true);
  assert.equal(game.brokerageOffers[0].status, "accepted");
  assert.equal(game.players[0].resources.currency, before[0].currency + 1);
  assert.equal(game.players[1].resources.material, before[1].material - 1);
  assert.equal(game.players[2].resources.currency, before[2].currency - 1);
  assert.equal(respondBrokerage(game, "consent-1", 2, true).ok, false);
});

test("declining a brokerage offer leaves every resource untouched", () => {
  const game = createGame(3, ["meridian", "foundry", "helix"], "shattered-reach", "horizon-base", 3318);
  for (const player of game.players) { player.resources.material = 5; player.resources.currency = 5; }
  const a = { material: 1, currency: 0, research: 0, labor: 0 };
  const b = { material: 0, currency: 1, research: 0, labor: 0 };
  assert.equal(proposeBrokerage(game, 0, 1, 2, a, b, "consent-2").ok, true);
  assert.equal(respondBrokerage(game, "consent-2", 1, true).ok, true);
  const before = game.players.map((player) => ({ ...player.resources }));
  assert.equal(respondBrokerage(game, "consent-2", 2, false).ok, true);
  assert.equal(game.brokerageOffers[0].status, "rejected");
  assert.deepEqual(game.players.map((player) => player.resources), before);
});

test("room Brokerage remains private and settles only after authenticated approvals", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, ["meridian", "foundry", "helix", "aurelians"], "shattered-reach", "horizon-base", 3319);
  for (const player of game.players) {
    player.resources.material = 5;
    player.resources.currency = 5;
    drawHiddenChoices(game, player.id, game.era);
    selectHiddenLegacy(game, player.id, player.hiddenLegacy[game.era].choices[0]);
  }
  const host = await service.create(game, "Broker", "network");
  const first = await service.join(host.code, 1, "Trader A");
  const second = await service.join(host.code, 2, "Trader B");
  const outsider = await service.join(host.code, 3, "Outsider");
  const stored = (await repository.get(host.code))!;
  stored.status = "active";
  await repository.put(stored);
  const current = await service.resume(host.code, host.token);
  const offered = await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: current.revision,
    command: { kind: "brokerTrade", a: 1, b: 2, aGives: { material: 1, currency: 0, research: 0, labor: 0 }, bGives: { material: 0, currency: 1, research: 0, labor: 0 } } });
  assert.equal(offered.ok, true, offered.message);
  const offerId = offered.session!.game.brokerageOffers[0].id;
  assert.equal((await service.resume(host.code, first.token)).game.brokerageOffers[0]?.id, offerId);
  assert.equal((await service.resume(host.code, outsider.token)).game.brokerageOffers.length, 0);
  assert.equal((await repository.get(host.code))!.game.players[1].resources.material, 5);
  const denied = await executeRoomCommand(repository, { code: host.code, token: outsider.token, expectedRevision: offered.session!.revision,
    command: { kind: "respondBrokerage", offerId, accept: true } });
  assert.equal(denied.ok, false);
  const firstResponse = await executeRoomCommand(repository, { code: host.code, token: first.token, expectedRevision: offered.session!.revision,
    command: { kind: "respondBrokerage", offerId, accept: true } });
  assert.equal(firstResponse.ok, true, firstResponse.message);
  assert.equal((await repository.get(host.code))!.game.players[1].resources.material, 5);
  const settled = await executeRoomCommand(repository, { code: host.code, token: second.token, expectedRevision: firstResponse.session!.revision,
    command: { kind: "respondBrokerage", offerId, accept: true } });
  assert.equal(settled.ok, true, settled.message);
  assert.equal((await repository.get(host.code))!.game.players[1].resources.material, 4);
  assert.equal((await repository.get(host.code))!.game.players[2].resources.currency, 4);
});

test("existing rooms gain an empty Brokerage inbox during normalization", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const room = await service.create(createGame(4, ["meridian", "foundry", "helix", "aurelians"], "shattered-reach", "horizon-base", 3320), "Host", "network");
  const stored = (await repository.get(room.code))!;
  delete (stored.game as Partial<GameState>).brokerageOffers;
  assert.deepEqual(normalizeStoredRoom(stored).game.brokerageOffers, []);
});

test("contextual movement, fit zoom, audio and resource glyphs remain exposed", async () => {
  const board = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  const lobby = await readFile("app/components/network/RoomLobby.tsx", "utf8");
  const sound = await readFile("app/components/network/GameplayAudio.tsx", "utf8");
  assert.match(board, /minZoom: 0\.2/);
  assert.match(board, /Move vessel/);
  assert.doesNotMatch(board, /selectedCarrier\.type !== "bombardFrigate" && <button/);
  assert.match(lobby, /factionGuides/);
  assert.match(sound, /tactical-focus\.mp3/);
});
