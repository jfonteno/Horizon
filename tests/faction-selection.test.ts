import assert from "node:assert/strict";
import test from "node:test";
import { createGame, executeRoomCommand, MemoryRoomRepository, RoomService } from "../game/index";

const factions = ["farbound", "helix", "foundry", "aurelians"] as const;

function fixture() {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 18101, [
    { kind: "human" },
    { kind: "human" },
    { kind: "bot", profileId: "strategic-director" },
    { kind: "bot", profileId: "strategic-director" },
  ]);
  return { repository, service, game };
}

test("network players claim seats before choosing unique factions", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  assert.equal(host.summary.seats[0].faction, null);
  assert.equal(host.summary.seats[1].faction, null);

  const guestStart = guest.game.players[1].explorer;
  const guestChoice = await executeRoomCommand(repository, {
    code: host.code, token: guest.token, expectedRevision: guest.revision,
    commandId: "guest-varkesh", command: { kind: "selectFaction", factionId: "varkesh" },
  });
  assert.equal(guestChoice.ok, true);
  assert.equal(guestChoice.session!.summary.seats[1].faction, "varkesh");
  assert.equal(guestChoice.session!.game.players[1].faction, "varkesh");
  assert.equal(guestChoice.session!.game.players[1].explorer, guestStart);

  const currentHost = await service.resume(host.code, host.token);
  const duplicate = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: currentHost.revision,
    commandId: "host-duplicate", command: { kind: "selectFaction", factionId: "varkesh" },
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /already selected/i);

  const hostChoice = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: currentHost.revision,
    commandId: "host-farbound", command: { kind: "selectFaction", factionId: "farbound" },
  });
  assert.equal(hostChoice.ok, true);
  assert.equal(hostChoice.session!.summary.seats[0].faction, "farbound");
});

test("Ready locks faction selection and game start requires every human choice", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");

  const prematureReady = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: guest.revision,
    commandId: "premature-ready", command: { kind: "setReady", ready: true },
  });
  assert.equal(prematureReady.ok, false);
  assert.match(prematureReady.message, /choose a faction/i);

  let revision = guest.revision;
  const guestChoice = await executeRoomCommand(repository, {
    code: host.code, token: guest.token, expectedRevision: revision,
    commandId: "guest-varkesh-ready", command: { kind: "selectFaction", factionId: "varkesh" },
  });
  revision = guestChoice.session!.revision;
  const guestReady = await executeRoomCommand(repository, {
    code: host.code, token: guest.token, expectedRevision: revision,
    commandId: "guest-ready", command: { kind: "setReady", ready: true },
  });
  revision = guestReady.session!.revision;
  const lockedChoice = await executeRoomCommand(repository, {
    code: host.code, token: guest.token, expectedRevision: revision,
    commandId: "guest-locked-choice", command: { kind: "selectFaction", factionId: "meridian" },
  });
  assert.equal(lockedChoice.ok, false);
  assert.match(lockedChoice.message, /not ready/i);
  const hostChoice = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: revision,
    commandId: "host-farbound-ready", command: { kind: "selectFaction", factionId: "farbound" },
  });
  revision = hostChoice.session!.revision;
  const hostReady = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: revision,
    commandId: "host-ready", command: { kind: "setReady", ready: true },
  });
  revision = hostReady.session!.revision;

  const started = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: revision,
    commandId: "start-faction-draft", command: { kind: "startGame" },
  });
  assert.equal(started.ok, true);
  assert.equal(started.session!.summary.status, "active");
  const startedFactions = started.session!.game.players.map((player) => player.faction);
  assert.deepEqual(startedFactions.slice(0, 2), ["farbound", "varkesh"]);
  assert.equal(new Set(startedFactions).size, 4);
  assert.ok(started.session!.summary.seats.slice(2).every((seat) => !seat.randomFaction && Boolean(seat.faction)));
});

test("host may assign a bot faction or leave it random until launch", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  assert.equal(host.summary.seats[2].randomFaction, true);
  assert.equal(host.summary.seats[2].faction, null);
  const assigned = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision,
    commandId: "assign-bot-faction", command: { kind: "setBotFaction", playerId: 2, factionId: "meridian", random: false },
  });
  assert.equal(assigned.ok, true);
  assert.equal(assigned.session!.summary.seats[2].faction, "meridian");
  const randomized = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: assigned.session!.revision,
    commandId: "randomize-bot-faction", command: { kind: "setBotFaction", playerId: 2, random: true },
  });
  assert.equal(randomized.ok, true);
  assert.equal(randomized.session!.summary.seats[2].randomFaction, true);
  assert.equal(randomized.session!.summary.seats[2].faction, null);
});

test("reopening a lobby seat releases its selected faction", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  const selected = await executeRoomCommand(repository, {
    code: host.code, token: guest.token, expectedRevision: guest.revision,
    commandId: "guest-meridian", command: { kind: "selectFaction", factionId: "meridian" },
  });
  const reopened = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: selected.session!.revision,
    commandId: "reopen-faction-seat", command: { kind: "resetHumanSeat", playerId: 1 },
  });
  assert.equal(reopened.ok, true);
  assert.equal(reopened.session!.summary.seats[1].faction, null);
  assert.equal(reopened.session!.summary.seats[1].claimed, false);
});
