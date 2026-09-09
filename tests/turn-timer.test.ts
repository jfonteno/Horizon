import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  executeRoomCommand,
  MemoryRoomRepository,
  reconcileExpiredTurnTimer,
  RoomService,
  verifyRoomAudit,
} from "../game/index";

const factions = ["farbound", "helix", "foundry", "aurelians"] as const;

async function startedTimedRoom() {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 18301, [
    { kind: "human" },
    { kind: "human" },
    { kind: "bot", profileId: "strategic-director" },
    { kind: "bot", profileId: "strategic-director" },
  ]);
  let host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  host = await service.resume(host.code, host.token);

  for (const [token, factionId] of [[host.token, "farbound"], [guest.token, "helix"]] as const) {
    let session = await service.resume(host.code, token);
    session = (await executeRoomCommand(repository, { code: host.code, token, expectedRevision: session.revision, command: { kind: "selectFaction", factionId } })).session!;
    await executeRoomCommand(repository, { code: host.code, token, expectedRevision: session.revision, command: { kind: "setReady", ready: true } });
  }
  host = await service.resume(host.code, host.token);
  host = (await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: host.revision, command: { kind: "setTurnTimer", seconds: 60 } })).session!;
  host = (await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: host.revision, command: { kind: "startGame" } })).session!;
  return { repository, service, host, guest };
}

test("host-configured Turn timers persist in the public room summary", async () => {
  const { service, host } = await startedTimedRoom();
  const resumed = await service.resume(host.code, host.token);
  assert.equal(resumed.summary.turnTimerSeconds, 60);
  assert.ok(resumed.summary.turnDeadlineAt);
  assert.equal(resumed.summary.status, "active");
});

test("an expired timer gives missing humans Hold and resolves the Turn", async () => {
  const { repository, service, host } = await startedTimedRoom();
  const before = (await repository.get(host.code))!;
  const deadline = Date.parse(before.turnDeadlineAt!);
  assert.equal(await reconcileExpiredTurnTimer(repository, host.code, deadline + 1), true);

  const after = (await repository.get(host.code))!;
  assert.equal(after.game.turn, 2);
  assert.ok(after.turnDeadlineAt);
  assert.ok(Date.parse(after.turnDeadlineAt) > deadline);
  assert.match(after.events.at(-1)!.message, /Automatic Hold/i);
  assert.equal(after.audit.at(-1)!.commandKind, "turnTimerExpired");
  assert.equal((await verifyRoomAudit(after)).ok, true);
  assert.equal((await service.resume(host.code, host.token)).summary.turn, 2);
});

test("pausing preserves the timer and resuming restores a deadline", async () => {
  const { repository, service, host } = await startedTimedRoom();
  let current = await service.resume(host.code, host.token);
  current = (await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: current.revision, command: { kind: "pauseGame" } })).session!;
  assert.equal(current.summary.turnDeadlineAt, null);
  assert.equal((await repository.get(host.code))!.turnTimerPausedRemainingMs !== null, true);
  current = (await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: current.revision, command: { kind: "resumeGame" } })).session!;
  assert.ok(current.summary.turnDeadlineAt);
});
