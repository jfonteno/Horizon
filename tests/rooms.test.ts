import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  MemoryRoomRepository,
  projectPrivateGame,
  RoomService,
} from "../game/index";

const factions = ["farbound", "helix", "foundry", "meridian"] as const;

test("room codes create resumable host sessions and claim private seats", async () => {
  const service = new RoomService(new MemoryRoomRepository());
  const game = createGame(
    4,
    [...factions],
    "shattered-reach",
    "horizon-base",
    8001,
  );
  const created = await service.create(game, "Host");
  assert.match(created.code, /^[A-Z2-9]{6}$/);
  assert.equal(created.role, "host");

  const joined = await service.join(created.code, 1, "Researcher");
  assert.equal(joined.playerId, 1);
  assert.equal(joined.summary.seats[1].displayName, "Researcher");
  assert.equal((await service.resume(created.code, joined.token)).playerId, 1);
  await assert.rejects(() => service.join(created.code, 1, "Second claim"));
});

test("private room views redact other civilizations and hidden worlds", () => {
  const game = createGame(
    4,
    [...factions],
    "shattered-reach",
    "horizon-base",
    8002,
  );
  game.players[0].hiddenLegacy[1] = {
    choices: ["h1-frontier"],
    selected: "h1-frontier",
  };
  game.players[1].hiddenLegacy[1] = {
    choices: ["h1-first"],
    selected: "h1-first",
  };
  const hidden = game.hexes.filter(
    (hex) => !hex.revealed && hex.kind !== "empty" && hex.kind !== "rift",
  );
  game.players[1].privateSurveys.push({
    hexId: hidden[0].id,
    kind: hidden[0].kind,
    surveyedTurn: 1,
    soldTo: [],
  });
  const view = projectPrivateGame(game, 1);
  assert.deepEqual(view.players[0].hiddenLegacy, {});
  assert.equal(view.players[0].privateSurveys.length, 0);
  assert.equal(view.players[1].hiddenLegacy[1].selected, "h1-first");
  assert.equal(view.hexes.find((hex) => hex.id === hidden[0].id)?.kind, hidden[0].kind);
  assert.equal(view.hexes.find((hex) => hex.id === hidden[1].id)?.kind, "empty");
});

test("only hosts publish room snapshots and stale revisions are rejected", async () => {
  const service = new RoomService(new MemoryRoomRepository());
  const game = createGame(
    4,
    [...factions],
    "shattered-reach",
    "horizon-base",
    8003,
  );
  const host = await service.create(game, "Host");
  const player = await service.join(host.code, 2, "Builder");
  const updated = structuredClone(game);
  updated.gate = 1;
  const saved = await service.save(
    host.code,
    host.token,
    host.revision,
    updated,
  );
  assert.equal(saved.revision, 2);
  assert.equal(saved.game.gate, 1);
  await assert.rejects(() =>
    service.save(host.code, host.token, host.revision, updated),
  );
  await assert.rejects(() =>
    service.save(host.code, player.token, saved.revision, updated),
  );
});
