import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { replaceRoomFile } from "../game/server/atomic-room-save";
import { DiskRoomRepository } from "../game/server/disk-room-repository";
import { createGame, RoomService } from "../game/index";

test("Windows replacement retries temporary locks without changing source or target", async () => {
  const codes = ["EPERM", "EACCES", "EBUSY"];
  const waits: number[] = [];
  let calls = 0;
  await replaceRoomFile("complete.tmp", "room.json", {
    platform: "win32",
    renameFile: async (source, target) => {
      assert.equal(source, "complete.tmp"); assert.equal(target, "room.json");
      const code = codes[calls++];
      if (code) throw Object.assign(new Error("locked"), { code });
    },
    wait: async (delay) => { waits.push(delay); },
  });
  assert.equal(calls, 4);
  assert.deepEqual(waits, [25, 50, 100]);
});

test("permanent locks are bounded and non-lock failures are not retried", async () => {
  for (const [platform, code, expectedCalls] of [["win32", "EPERM", 10], ["win32", "ENOSPC", 1], ["linux", "EPERM", 1]] as const) {
    let calls = 0;
    await assert.rejects(replaceRoomFile("a", "b", {
      platform,
      renameFile: async () => { calls++; throw Object.assign(new Error(code), { code }); },
      wait: async () => {},
    }), { message: code });
    assert.equal(calls, expectedCalls);
  }
});

test("failed replacement preserves the committed save and allows a later retry", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-lock-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  let locked = false;
  let attempts = 0;
  const repository = new DiskRoomRepository(directory, (source, target) => replaceRoomFile(source, target, {
    platform: "win32", wait: async () => {},
    renameFile: async (from, to) => {
      attempts++;
      if (locked) throw Object.assign(new Error("locked"), { code: "EPERM" });
      await rename(from, to);
    },
  }));
  const created = await new RoomService(repository).create(createGame(4, ["farbound", "helix", "foundry", "meridian"], "shattered-reach", "horizon-base", 212), "Host");
  const original = (await repository.get(created.code))!;
  const path = join(directory, `${created.code}.json`);
  const saved = await readFile(path, "utf8");
  const next = structuredClone(original);
  next.revision++; next.game.turn = 10;
  locked = true;
  await assert.rejects(repository.compareAndSwap(next, original.revision), /previous save has not been replaced/);
  assert.equal(await readFile(path, "utf8"), saved);
  assert.equal((await repository.get(created.code))?.revision, original.revision);
  assert.equal(attempts, 11);
  locked = false;
  assert.equal(await repository.compareAndSwap(next, original.revision), true);
  assert.equal((await repository.get(created.code))?.game.turn, 10);
  assert.equal(await repository.compareAndSwap(next, original.revision), false);
});

test("room polling waits for an in-flight replacement", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-poll-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  let pause = false;
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const repository = new DiskRoomRepository(directory, async (from, to) => {
    if (pause) { entered(); await gate; }
    await rename(from, to);
  });
  const created = await new RoomService(repository).create(createGame(4, ["farbound", "helix", "foundry", "meridian"], "shattered-reach", "horizon-base", 213), "Host");
  const next = (await repository.get(created.code))!;
  const revision = next.revision++;
  pause = true;
  const saving = repository.compareAndSwap(next, revision);
  await started;
  const reading = repository.get(created.code);
  release();
  assert.equal(await saving, true);
  assert.equal((await reading)?.revision, revision + 1);
});
