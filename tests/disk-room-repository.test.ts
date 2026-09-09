import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGame } from "../game/index";
import { DiskRoomRepository } from "../game/server/disk-room-repository";
import { RoomService } from "../game/server/rooms";

const factions = ["farbound", "helix", "foundry", "meridian"] as const;

test("disk rooms survive a repository restart", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-rooms-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const firstRepository = new DiskRoomRepository(directory);
  const created = await new RoomService(firstRepository).create(
    createGame(4, [...factions], "shattered-reach", "horizon-base", 1601),
    "Host",
    "network",
  );

  const restartedRepository = new DiskRoomRepository(directory);
  const resumed = await new RoomService(restartedRepository).resume(created.code, created.token);
  assert.equal(resumed.code, created.code);
  assert.equal(resumed.revision, created.revision);
  assert.equal((await restartedRepository.health()).ok, true);
  assert.match(await readFile(join(directory, `${created.code}.json`), "utf8"), /"schemaVersion":5/);
});

test("disk compare-and-swap permits only one concurrent room revision", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-cas-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const repository = new DiskRoomRepository(directory);
  const created = await new RoomService(repository).create(
    createGame(4, [...factions], "shattered-reach", "horizon-base", 1602),
    "Host",
  );
  const original = await repository.get(created.code);
  assert.ok(original);

  const first = structuredClone(original);
  const second = structuredClone(original);
  first.revision++;
  second.revision++;
  first.game.gate = 1;
  second.game.gate = 2;

  const outcomes = await Promise.all([
    repository.compareAndSwap(first, original.revision),
    repository.compareAndSwap(second, original.revision),
  ]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.ok([1, 2].includes((await repository.get(created.code))?.game.gate ?? -1));
});

test("disk rooms report corrupt payloads instead of silently resetting", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-corrupt-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "ABC234.json"), "not-json", "utf8");
  await assert.rejects(
    () => new DiskRoomRepository(directory).get("ABC234"),
    /corrupt and must be restored from backup/,
  );
});
