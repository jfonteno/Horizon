import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  createPlaytestReport,
  executeRoomCommand,
  MemoryRoomRepository,
  normalizeStoredRoom,
  RoomService,
  verifyRoomAudit,
} from "../game/index";
import type { StoredRoom } from "../game/server/types";

const factions = ["farbound", "helix", "foundry", "aurelians"] as const;

function fixture() {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 18001, [
    { kind: "human" },
    { kind: "human" },
    { kind: "bot", profileId: "strategic-director" },
    { kind: "bot", profileId: "strategic-director" },
  ]);
  return { repository, service, game };
}

test("new rooms chain accepted commands to the authoritative room state", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const selected = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: host.revision,
    commandId: "audit-select-host",
    command: { kind: "selectFaction", factionId: "farbound" },
  });
  const ready = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: selected.session!.revision,
    commandId: "audit-ready-host",
    command: { kind: "setReady", ready: true },
  });
  assert.equal(ready.ok, true);
  const room = (await repository.get(host.code))!;
  assert.equal(room.audit.length, 2);
  assert.equal(room.audit[1].commandId, "audit-ready-host");
  assert.equal(room.audit[1].commandKind, "setReady");
  assert.equal((await verifyRoomAudit(room)).ok, true);

  room.audit[1].commandLabel = "tampered";
  assert.equal((await verifyRoomAudit(room)).ok, false);
});

test("host playtest reports include metrics, diagnostics, and audit status", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: host.revision,
    commandId: "report-notice",
    command: { kind: "postHostNotice", message: "Resolve negotiation by 20:00." },
  });
  const room = await service.authenticateHost(host.code, host.token);
  const report = await createPlaytestReport(room);
  assert.equal(report.gameVersion, "0.20.2");
  assert.equal(report.setup.seed, 18001);
  assert.equal(report.setup.factions.length, 4);
  assert.equal(report.audit.integrity.ok, true);
  assert.equal(report.audit.entries[0].commandKind, "postHostNotice");
  assert.equal(report.replay.deterministic, true);
  assert.equal(report.replay.initialGame?.seed, 18001);
  assert.equal(report.replay.acceptedCommands[0].commandId, "report-notice");
  assert.match(report.events.at(-1)!.message, /^HOST:/);
  await assert.rejects(() => service.authenticateHost(host.code, "not-the-host-token"), /host/i);
});

test("host administration can reopen humans and switch bot seats both ways", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  let current = await service.resume(host.code, host.token);
  const reopened = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: current.revision,
    commandId: "reopen-guest",
    command: { kind: "resetHumanSeat", playerId: 1 },
  });
  assert.equal(reopened.session!.summary.seats[1].claimed, false);
  await assert.rejects(() => service.resume(host.code, guest.token), /valid/i);

  current = reopened.session!;
  const humanized = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: current.revision,
    commandId: "open-bot-seat",
    command: { kind: "convertSeatToHuman", playerId: 2 },
  });
  assert.equal(humanized.session!.summary.seats[2].controller.kind, "human");
  const automated = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: humanized.session!.revision,
    commandId: "restore-bot-seat",
    command: { kind: "convertSeatToBot", playerId: 2, profileId: "strategic-director" },
  });
  assert.equal(automated.session!.summary.seats[2].controller.kind, "bot");
});

test("pre-0.18 rooms migrate without claiming a complete audit history", async () => {
  const { service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const room = await service.getStoredRoom(host.code);
  const legacy = structuredClone(room) as Partial<StoredRoom>;
  delete legacy.audit;
  delete legacy.initialStateHash;
  delete legacy.auditStartRevision;
  delete legacy.availableFactions;
  legacy.schemaVersion = 3;
  legacy.seats!.forEach((seat, index) => {
    delete (seat as Partial<typeof seat>).selectedFaction;
    seat.ready = index > 1;
  });
  const migrated = normalizeStoredRoom(legacy as StoredRoom);
  assert.deepEqual(migrated.audit, []);
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.turnTimerSeconds, null);
  assert.deepEqual(migrated.seats.map((seat) => seat.selectedFaction), migrated.game.players.map((player) => player.faction));
  const status = await verifyRoomAudit(migrated);
  assert.equal(status.complete, false);
  assert.match(status.message, /predates/i);
});

test("existing 61-hex Standard Board rooms retain legacy geometry", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "standard-board-61", "horizon-base", 18002);
  const host = await service.create(game, "Host", "network");
  const stored = await service.getStoredRoom(host.code);
  stored.game.mapId = "standard-board";
  const migrated = normalizeStoredRoom(stored);
  assert.equal(migrated.game.mapId, "standard-board-61");
  assert.equal(migrated.game.hexes.filter((hex) => hex.kind !== "rift").length, 61);
});
