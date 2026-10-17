import assert from "node:assert/strict";
import test from "node:test";
import { createGame, executeRoomCommand, MemoryRoomRepository, RoomService } from "../game/index";

const factions = ["farbound", "helix", "foundry", "aurelians"] as const;

function fixture() {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 19339, [
    { kind: "human" },
    { kind: "human" },
    { kind: "bot", profileId: "strategic-director" },
    { kind: "bot", profileId: "strategic-director" },
  ]);
  return { repository, service, game };
}

test("automatic launch defaults off and only the host may change it", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  assert.equal(guest.summary.autoStartWhenReady, false);

  const denied = await executeRoomCommand(repository, {
    code: host.code,
    token: guest.token,
    expectedRevision: guest.revision,
    commandId: "guest-auto-start",
    command: { kind: "setAutoStart", enabled: true },
  });
  assert.equal(denied.ok, false);
  assert.match(denied.message, /only the host/i);

  const currentHost = await service.resume(host.code, host.token);
  const enabled = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: currentHost.revision,
    commandId: "host-auto-start",
    command: { kind: "setAutoStart", enabled: true },
  });
  assert.equal(enabled.ok, true);
  assert.equal(enabled.session!.summary.autoStartWhenReady, true);
  assert.equal((await service.resume(host.code, guest.token)).summary.autoStartWhenReady, true);
});

test("the final human readiness update launches without an online host and starts the timer", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network", null, "horizon", true);
  const guest = await service.join(host.code, 1, "Guest");

  let hostSession = await service.resume(host.code, host.token);
  hostSession = (await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: hostSession.revision,
    commandId: "auto-host-faction", command: { kind: "selectFaction", factionId: "farbound" },
  })).session!;
  hostSession = (await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: hostSession.revision,
    commandId: "auto-timer", command: { kind: "setTurnTimer", seconds: 60 },
  })).session!;
  hostSession = (await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: hostSession.revision,
    commandId: "auto-host-ready", command: { kind: "setReady", ready: true },
  })).session!;
  assert.equal(hostSession.summary.status, "lobby");

  let guestSession = await service.resume(host.code, guest.token);
  guestSession = (await executeRoomCommand(repository, {
    code: host.code, token: guest.token, expectedRevision: guestSession.revision,
    commandId: "auto-guest-faction", command: { kind: "selectFaction", factionId: "helix" },
  })).session!;
  const launched = await executeRoomCommand(repository, {
    code: host.code, token: guest.token, expectedRevision: guestSession.revision,
    commandId: "auto-final-ready", command: { kind: "setReady", ready: true },
  });

  assert.equal(launched.ok, true);
  assert.match(launched.message, /began automatically/i);
  assert.equal(launched.session!.summary.status, "active");
  assert.equal(launched.session!.summary.turnTimerSeconds, 60);
  assert.ok(launched.session!.summary.turnDeadlineAt);
  assert.ok(launched.session!.summary.seats.slice(2).every((seat) => seat.faction && !seat.randomFaction));
  assert.equal((await service.resume(host.code, host.token)).summary.status, "active");
});

test("ready state persists but does not launch when the option is disabled", async () => {
  const { repository, service, game } = fixture();
  const host = await service.create(game, "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  for (const [token, factionId] of [[host.token, "farbound"], [guest.token, "helix"]] as const) {
    let session = await service.resume(host.code, token);
    session = (await executeRoomCommand(repository, {
      code: host.code, token, expectedRevision: session.revision,
      command: { kind: "selectFaction", factionId },
    })).session!;
    await executeRoomCommand(repository, {
      code: host.code, token, expectedRevision: session.revision,
      command: { kind: "setReady", ready: true },
    });
  }
  const resumed = await service.resume(host.code, guest.token);
  assert.equal(resumed.summary.status, "lobby");
  assert.equal(resumed.summary.seats[0].ready, true);
  assert.equal(resumed.summary.seats[1].ready, true);
});
