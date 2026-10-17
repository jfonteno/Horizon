import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createGame,
  executeRoomCommand,
  MemoryRoomRepository,
  prepareHiddenChoicesForEra,
  RoomService,
} from "../game/index";

const factions = ["farbound", "helix", "foundry", "aurelians"] as const;

test("every four-Era game prepares three unique Hidden Legacy choices", () => {
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 33600);
  for (const era of [1, 2, 3, 4]) {
    game.players[0].hiddenLegacy[era] = { choices: [] };
    prepareHiddenChoicesForEra(game, era);
    for (const player of game.players) {
      const choices = player.hiddenLegacy[era].choices;
      assert.equal(choices.length, 3);
      assert.equal(new Set(choices).size, 3);
    }
  }
});

test("post-combat CU cleanup can complete before an Era IV Hidden Legacy selection", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 33601);
  game.turn = 13;
  game.era = 4;
  game.orderProtocol.turn = 13;
  prepareHiddenChoicesForEra(game, 4);

  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  carrier.cu = 1;
  game.pendingCombatRedistributions = [{
    hexId: carrier.hex,
    playerId: 0,
    total: 1,
    carrierIds: [carrier.id],
    allowStationed: false,
  }];

  let session = await service.create(game, "Commander", "network");
  const room = (await repository.get(session.code))!;
  room.status = "active";
  await repository.put(room);
  session = await service.resume(session.code, session.token);

  const cleanup = await executeRoomCommand(repository, {
    code: session.code,
    token: session.token,
    expectedRevision: session.revision,
    commandId: "era-four-cleanup",
    command: {
      kind: "redistributeCombatUnits",
      hexId: carrier.hex,
      assignments: [{ carrierId: carrier.id, cu: 1 }],
      stationed: 0,
    },
  });
  assert.equal(cleanup.ok, true, cleanup.message);
  assert.equal(cleanup.session!.game.pendingCombatRedistributions.length, 0);

  const cardId = cleanup.session!.game.players[0].hiddenLegacy[4].choices[0];
  const selected = await executeRoomCommand(repository, {
    code: session.code,
    token: session.token,
    expectedRevision: cleanup.session!.revision,
    commandId: "era-four-hidden",
    command: { kind: "selectHidden", cardId },
  });
  assert.equal(selected.ok, true, selected.message);
  assert.equal(selected.session!.game.players[0].hiddenLegacy[4].selected, cardId);
});

test("the Era objective overlay yields to mandatory combat cleanup", async () => {
  const source = await readFile(
    new URL("../app/components/network/NetworkGameBoard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /hasMandatoryCombatCleanup/);
  assert.match(source, /!hasMandatoryCombatCleanup/);
  assert.match(source, /setPanel\("military"\)/);
});
