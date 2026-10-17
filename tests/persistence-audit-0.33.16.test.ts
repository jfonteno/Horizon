import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGame } from "../game/engine/create-game";
import { appendSystemAudit, verifyRoomAudit } from "../game/server/audit";
import { DiskRoomRepository } from "../game/server/disk-room-repository";
import { MemoryRoomRepository, RoomService } from "../game/server/rooms";

const factions = ["farbound", "helix", "foundry", "meridian"] as const;
const game = (seed: number) => createGame(4, [...factions], "shattered-reach", "horizon-base", seed);

test("disk reload keeps a destroyed Explorer absent and hashes the stored representation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-audit-"));
  try {
    const repository = new DiskRoomRepository(directory);
    const service = new RoomService(repository);
    const created = await service.create(game(331601), "Host");
    const room = (await repository.get(created.code))!;
    room.game.players[0].explorationVessels = [];
    room.revision++;
    room.updatedAt = new Date().toISOString();
    await appendSystemAudit(room, "explorer-destroyed", "testResolution", "Resolve combat", {});
    assert.equal(await repository.compareAndSwap(room, room.revision - 1), true);
    const reloaded = (await repository.get(created.code))!;
    assert.deepEqual(reloaded.game.players[0].explorationVessels, []);
    assert.equal((await verifyRoomAudit(reloaded)).ok, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("claim, account recovery, local publication, and rematch have audited revisions", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const created = await service.create(game(331602), "Host", "network", "account-host");
  const joined = await service.join(created.code, 1, "Guest", "account-guest");
  assert.equal((await verifyRoomAudit((await repository.get(created.code))!)).ok, true);
  await service.resumeByAccount(created.code, "account-guest");
  assert.equal((await verifyRoomAudit((await repository.get(created.code))!)).ok, true);
  assert.equal(joined.playerId, 1);

  const finished = (await repository.get(created.code))!;
  finished.status = "complete";
  finished.game.result = { gateSucceeded: true, winnerIds: [0], reason: "Test complete", finalizedTurn: 16 };
  await repository.put(finished);
  const rematch = await service.createRematch(created.code, created.token, "account-host");
  assert.equal((await verifyRoomAudit((await repository.get(rematch.code))!)).ok, true);

  const local = await service.create(game(331603), "Host", "local");
  await service.save(local.code, local.token, local.revision, game(331603));
  assert.equal((await verifyRoomAudit((await repository.get(local.code))!)).ok, true);
});
