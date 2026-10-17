import assert from "node:assert/strict";
import test from "node:test";
import {
  addTradeProposal,
  counterTradeProposal,
  createGame,
  emptyTradeBundle,
  executeRoomCommand,
  MemoryRoomRepository,
  RoomService,
} from "../game/index";
import type { RoomCommand, RoomSession } from "../game/index";

const factions = ["varkesh", "helix", "foundry", "meridian"] as const;

async function act(repository: MemoryRoomRepository, session: RoomSession, command: RoomCommand) {
  const result = await executeRoomCommand(repository, {
    code: session.code,
    token: session.token,
    expectedRevision: session.revision,
    command,
  });
  assert.equal(result.ok, true, result.message);
  return result.session!;
}

test("match chat persists All Chat and keeps direct messages private", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let host = await service.create(createGame(4, [...factions], "shattered-reach", "horizon-base", 30001), "Host", "network");
  const guestToken = (await service.join(host.code, 1, "Helix Player")).token;
  const observerToken = (await service.join(host.code, 2, "Foundry Player")).token;
  host = await service.resume(host.code, host.token);
  host = await act(repository, host, { kind: "sendChat", channelId: "all", text: "Gate planning starts here." });
  host = await act(repository, host, { kind: "createChat", participantIds: [0, 1] });
  host = await act(repository, host, { kind: "sendChat", channelId: "direct-0-1", text: "Private research negotiation." });

  const guest = await service.resume(host.code, guestToken);
  const observer = await service.resume(host.code, observerToken);
  assert.ok(guest.chat?.messages.some((message) => message.text === "Gate planning starts here."));
  assert.ok(guest.chat?.messages.some((message) => message.text === "Private research negotiation."));
  assert.ok(observer.chat?.messages.some((message) => message.text === "Gate planning starts here."));
  assert.ok(!observer.chat?.channels.some((channel) => channel.id === "direct-0-1"));
  assert.ok(!observer.chat?.messages.some((message) => message.text === "Private research negotiation."));
});

test("match blocking prevents new direct messages without affecting game actions", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let host = await service.create(createGame(4, [...factions], "shattered-reach", "horizon-base", 30002), "Host", "network");
  let guest = await service.join(host.code, 1, "Guest");
  host = await service.resume(host.code, host.token);
  host = await act(repository, host, { kind: "createChat", participantIds: [0, 1] });
  guest = await service.resume(host.code, guest.token);
  await act(repository, guest, { kind: "setPlayerBlocked", playerId: 0, blocked: true });
  host = await service.resume(host.code, host.token);
  const blocked = await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: host.revision, command: { kind: "sendChat", channelId: "direct-0-1", text: "This should not be delivered." } });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /not accepting direct messages/i);
});

test("group conversations stay private and reported messages enter the host review queue", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let host = await service.create(createGame(4, [...factions], "shattered-reach", "horizon-base", 30006), "Host", "network");
  let guest = await service.join(host.code, 1, "Guest");
  const allyToken = (await service.join(host.code, 2, "Ally")).token;
  const outsiderToken = (await service.join(host.code, 3, "Outsider")).token;
  host = await service.resume(host.code, host.token);
  host = await act(repository, host, { kind: "createChat", participantIds: [0, 1, 2], name: "Gate Coalition" });
  const group = host.chat?.channels.find((channel) => channel.kind === "group" && channel.name === "Gate Coalition");
  assert.ok(group);
  host = await act(repository, host, { kind: "sendChat", channelId: group!.id, text: "This plan stays with the coalition." });
  const ally = await service.resume(host.code, allyToken);
  const outsider = await service.resume(host.code, outsiderToken);
  assert.ok(ally.chat?.messages.some((message) => message.text === "This plan stays with the coalition."));
  assert.ok(!outsider.chat?.channels.some((channel) => channel.id === group!.id));

  guest = await service.resume(host.code, guest.token);
  guest = await act(repository, guest, { kind: "createChat", participantIds: [0, 1] });
  await act(repository, guest, { kind: "sendChat", channelId: "direct-0-1", text: "Review this message." });
  host = await service.resume(host.code, host.token);
  const reported = host.chat?.messages.find((message) => message.text === "Review this message.");
  assert.ok(reported);
  host = await act(repository, host, { kind: "reportChatMessage", messageId: reported!.id, reason: "Test report" });
  assert.equal(host.moderation?.length, 1);
  host = await act(repository, host, { kind: "reviewChatReport", reportId: host.moderation![0].id, action: "remove" });
  assert.equal(host.moderation?.length, 0);
  assert.ok(host.chat?.messages.some((message) => message.id === reported!.id && message.text === "Message removed by room moderation."));
});

test("Gate pledges are public room coordination state", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let host = await service.create(createGame(4, [...factions], "shattered-reach", "horizon-base", 30005), "Host", "network");
  const guest = await service.join(host.code, 1, "Guest");
  host = await service.resume(host.code, host.token);
  host = await act(repository, host, { kind: "setGatePledge", amount: 2 });
  const guestView = await service.resume(host.code, guest.token);
  assert.equal(guestView.gatePledges?.find((pledge) => pledge.playerId === 0 && pledge.era === 1)?.amount, 2);
  assert.ok(guestView.chat?.messages.some((message) => message.channelId === "system" && /pledged 2 Gate Tributes/.test(message.text)));
});

test("trade proposals normalize overlapping resources before evaluation", () => {
  const game = createGame(2, ["helix", "meridian"], "shattered-reach", "horizon-base", 30003);
  for (const player of game.players) {
    player.resources = { material: 10, currency: 10, research: 10, influence: 10 };
    player.diplomacy.contacts = [player.id === 0 ? 1 : 0];
  }
  game.agreements.push({ id: "trade", type: "trade", parties: [0, 1], startedTurn: 1 });
  const offer = emptyTradeBundle(), request = emptyTradeBundle();
  offer.research = 1;
  offer.currency = 1;
  request.currency = 1;
  assert.equal(addTradeProposal(game, { id: "netted", kind: "trade", from: 0, to: 1, offer, request, createdTurn: 1, status: "pending" }).ok, true);
  const stored = game.proposals.find((proposal) => proposal.id === "netted");
  assert.equal(stored?.kind, "trade");
  if (stored?.kind !== "trade") return;
  assert.deepEqual(stored.offer, { material: 0, currency: 0, research: 1, labor: 0 });
  assert.deepEqual(stored.request, emptyTradeBundle());
});

test("human counteroffers close the parent and preserve an inspectable chain", () => {
  const game = createGame(2, ["helix", "meridian"], "shattered-reach", "horizon-base", 30004);
  for (const player of game.players) {
    player.resources = { material: 10, currency: 10, research: 10, influence: 10 };
    player.diplomacy.contacts = [player.id === 0 ? 1 : 0];
  }
  game.agreements.push({ id: "trade", type: "trade", parties: [0, 1], startedTurn: 1 });
  const offer = emptyTradeBundle(), request = emptyTradeBundle();
  offer.research = 1;
  request.currency = 1;
  addTradeProposal(game, { id: "original", kind: "trade", from: 0, to: 1, offer, request, createdTurn: 1, status: "pending" });
  const counterOffer = emptyTradeBundle(), counterRequest = emptyTradeBundle();
  counterOffer.currency = 1;
  counterRequest.research = 2;
  const result = counterTradeProposal(game, 1, "original", "counter", counterOffer, counterRequest);
  assert.equal(result.ok, true);
  assert.equal(game.proposals.find((proposal) => proposal.id === "original")?.status, "rejected");
  const counter = game.proposals.find((proposal) => proposal.id === "counter");
  assert.equal(counter?.kind, "trade");
  if (counter?.kind !== "trade") return;
  assert.equal(counter.counterOf, "original");
  assert.equal(counter.counterDepth, 1);
});
