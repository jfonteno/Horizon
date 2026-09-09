import assert from "node:assert/strict";
import test from "node:test";
import { createGame, drawHiddenChoices, executeRoomCommand, MemoryRoomRepository, RoomService, selectHiddenLegacy, validateRoomCommand } from "../game/index";

const factions = ["farbound", "helix", "foundry", "aurelians"] as const;

function fixture() {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 15001);
  game.players[0].resources.material = 4;
  game.players[1].resources.currency = 4;
  game.players.forEach((player) => { player.resources.influence = 6; });
  game.players.forEach((player) => {
    drawHiddenChoices(game, player.id, game.era);
    selectHiddenLegacy(game, player.id, player.hiddenLegacy[game.era].choices[0]);
  });
  return { repository, service, game };
}

async function activate(repository: MemoryRoomRepository, service: RoomService, session: Awaited<ReturnType<RoomService["create"]>>) {
  const room = (await repository.get(session.code))!;
  room.status = "active";
  await repository.put(room);
  return service.resume(session.code, session.token);
}

test("authenticated military CU transfers update the canonical room", async () => {
  const { repository, service, game } = fixture();
  const startingCarrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  startingCarrier.cu = 1;
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  const before = carrier.cu;
  const result = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision,
    command: { kind: "transferCombatUnit", carrierId: carrier.id, direction: "load" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.session?.game.carriers.find((candidate) => candidate.id === carrier.id)?.cu, before + 1);
  assert.equal(result.session?.revision, host.revision + 1);
});

test("diplomacy proposals remain private and only the recipient can respond", async () => {
  const { repository, service, game } = fixture();
  game.players[0].tech.Economy = 4;
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  const second = await service.join(host.code, 1, "Scientist");
  const currentHost = await service.resume(host.code, host.token);
  const proposed = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: currentHost.revision,
    command: { kind: "proposeTrade", to: 1, offer: { material: 1, currency: 0, research: 0, labor: 0 }, request: { material: 0, currency: 1, research: 0, labor: 0 } },
  });
  const proposalId = proposed.session?.game.proposals[0]?.id;
  assert.ok(proposalId);
  const recipient = await service.resume(host.code, second.token);
  assert.equal(recipient.game.proposals[0]?.id, proposalId);

  const unauthorized = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: proposed.session!.revision,
    command: { kind: "respondProposal", proposalId, accept: true },
  });
  assert.equal(unauthorized.ok, false);
  assert.match(unauthorized.message, /receiving civilization/i);

  const accepted = await executeRoomCommand(repository, {
    code: host.code, token: second.token, expectedRevision: proposed.session!.revision,
    command: { kind: "respondProposal", proposalId, accept: true },
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.session?.game.players[1].resources.material, 1);
  assert.equal(accepted.session?.game.players[1].resources.currency, 3);
});

test("bot civilizations immediately evaluate incoming human trade proposals", async () => {
  const { repository, service, game } = fixture();
  game.players[0].tech.Economy = 4;
  game.players[1].controller = { kind: "bot", profileId: "strategic-director" };
  const startingCurrency = game.players[0].resources.currency;
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  const proposed = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision,
    command: { kind: "proposeTrade", to: 1, offer: { material: 2, currency: 0, research: 0, labor: 0 }, request: { material: 0, currency: 1, research: 0, labor: 0 } },
  });
  assert.equal(proposed.ok, true);
  assert.equal(proposed.session?.game.proposals[0]?.status, "accepted");
  assert.equal(proposed.session?.game.players[0].resources.currency, startingCurrency + 1);
  assert.match(proposed.botMessages?.join(" ") || "", /Accepted trade proposal/i);
});

test("network players must select a Hidden objective before other Era actions", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 15012);
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  const blocked = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision,
    command: { kind: "marketExchange", give: "material", get: "currency" },
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /Hidden Legacy objective/i);
  const drawn = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision,
    command: { kind: "drawHidden" },
  });
  const cardId = drawn.session!.game.players[0].hiddenLegacy[1].choices[0];
  const selected = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: drawn.session!.revision,
    command: { kind: "selectHidden", cardId },
  });
  assert.equal(selected.ok, true);
});

test("network Farbound survey is private, once per Turn, and available before Orders seal", async () => {
  const { repository, service, game } = fixture();
  const target = game.hexes.find((hex) => !hex.revealed && hex.kind !== "rift")!;
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  const surveyed = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision,
    command: { kind: "negotiationSurvey", hexId: target.id },
  });
  assert.equal(surveyed.ok, true);
  assert.equal(surveyed.session!.game.players[0].privateSurveys[0].hexId, target.id);
  const repeated = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: surveyed.session!.revision,
    command: { kind: "negotiationSurvey", hexId: game.hexes.find((hex) => !hex.revealed && hex.kind !== "rift" && hex.id !== target.id)!.id },
  });
  assert.equal(repeated.ok, false);
  assert.match(repeated.message, /already gathered/i);
});

test("network agreement commands create and schedule treaty withdrawal", async () => {
  const { repository, service, game } = fixture();
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  const second = await service.join(host.code, 1, "Scientist");
  const current = await service.resume(host.code, host.token);
  const proposed = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: current.revision,
    command: { kind: "proposeAgreement", to: 1, agreementType: "trade" },
  });
  const proposalId = proposed.session!.game.proposals[0].id;
  const accepted = await executeRoomCommand(repository, {
    code: host.code, token: second.token, expectedRevision: proposed.session!.revision,
    command: { kind: "respondProposal", proposalId, accept: true },
  });
  const agreementId = accepted.session!.game.agreements[0].id;
  const withdrawn = await executeRoomCommand(repository, {
    code: host.code, token: second.token, expectedRevision: accepted.session!.revision,
    command: { kind: "withdrawAgreement", agreementId },
  });
  assert.equal(withdrawn.ok, true);
  assert.equal(withdrawn.session!.game.agreements[0].endsAfterTurn, game.turn);
});

test("invalid tokens, stale revisions, and whole-state publication are rejected", async () => {
  const { repository, service, game } = fixture();
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  await assert.rejects(() => executeRoomCommand(repository, { code: host.code, token: "invalid", expectedRevision: host.revision, command: { kind: "drawHidden" } }), /token/i);
  const first = await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: host.revision, command: { kind: "drawHidden" } });
  assert.equal(first.ok, true);
  await assert.rejects(() => executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: host.revision, command: { kind: "drawHidden" } }), /revision/i);
  await assert.rejects(() => service.save(host.code, host.token, first.session!.revision, game), /server-authoritative/i);
});

test("captured Center bookkeeping blocks other commands until the conqueror decides", async () => {
  const { repository, service, game } = fixture();
  const habitat = game.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  habitat.centers = ["material", "currency"];
  game.pendingCenterLoss = { hexId: habitat.id, playerId: 0, removeCount: 1 };
  const host = await activate(repository, service, await service.create(game, "Commander", "network"));
  const second = await service.join(host.code, 1, "Scientist");
  const blocked = await executeRoomCommand(repository, {
    code: host.code, token: second.token, expectedRevision: second.revision,
    command: { kind: "drawHidden" },
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /finish captured Center losses/i);
  const currentHost = await service.resume(host.code, host.token);
  const resolved = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: currentHost.revision,
    command: { kind: "removeCapturedCenter", centerIndex: 0 },
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.session!.game.pendingCenterLoss, undefined);
});

test("multiplayer lobby readiness, host controls, and command idempotency", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "shattered-reach", "horizon-base", 15010, [
    { kind: "human" },
    { kind: "bot", profileId: "strategic-director" },
    { kind: "bot", profileId: "strategic-director" },
    { kind: "bot", profileId: "strategic-director" },
  ]);
  const host = await service.create(game, "Commander", "network");
  assert.equal(host.summary.status, "lobby");
  const selected = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: host.revision, commandId: "select-once",
    command: { kind: "selectFaction", factionId: "farbound" },
  });
  const ready = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: selected.session!.revision, commandId: "ready-once",
    command: { kind: "setReady", ready: true },
  });
  const duplicate = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: selected.session!.revision, commandId: "ready-once",
    command: { kind: "setReady", ready: true },
  });
  assert.equal(duplicate.session?.revision, ready.session?.revision);
  const started = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: ready.session!.revision, commandId: "start-once",
    command: { kind: "startGame" },
  });
  assert.equal(started.session?.summary.status, "active");
  const paused = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: started.session!.revision, commandId: "pause-once",
    command: { kind: "pauseGame" },
  });
  assert.equal(paused.session?.summary.status, "paused");
  const blocked = await executeRoomCommand(repository, {
    code: host.code, token: host.token, expectedRevision: paused.session!.revision, commandId: "blocked-while-paused",
    command: { kind: "drawHidden" },
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /paused/i);
});

test("runtime room command validation rejects malformed untrusted payloads", () => {
  assert.throws(() => validateRoomCommand({ kind: "unknown" }), /not supported/i);
  assert.throws(() => validateRoomCommand({ kind: "submitOrders", orders: "not-an-array" }), /array/i);
  assert.throws(() => validateRoomCommand({ kind: "removeCapturedCenter", centerIndex: -1 }), /non-negative/i);
});
