import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createFirstHorizon,
  createGame,
  executeRoomCommand,
  firstHorizonLessons,
  MemoryRoomRepository,
  RoomService,
} from "../game/index";

const factions = ["varkesh", "helix", "foundry", "aurelians"] as const;

test("First Horizon advances Hidden Legacy and map inspection through authoritative room events", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let session = await service.create(createFirstHorizon(), "Learner", "local");
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "advanceTutorial" } })).session!;
  assert.equal(firstHorizonLessons[session.game.tutorial!.step].id, "legacy");
  const cardId = session.game.players[0].hiddenLegacy[1].choices[0];
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "selectHidden", cardId } })).session!;
  assert.equal(firstHorizonLessons[session.game.tutorial!.step].id, "inspect");
  const target = session.game.hexes.find((hex) => hex.kind !== "home" && hex.kind !== "rift")!;
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "tutorialEvent", event: "hex-inspected", value: target.id } })).session!;
  assert.equal(firstHorizonLessons[session.game.tutorial!.step].id, "explore");
});

test("private sessions expose a phase and an actionable return checklist", async () => {
  const service = new RoomService(new MemoryRoomRepository());
  const session = await service.create(createGame(4, [...factions], "standard-board", "horizon-base", 28001), "Host", "network");
  assert.equal(session.summary.phase, "lobby");
  assert.equal(session.summary.hostPlayerId, 0);
  assert.equal(session.attention[0]?.kind, "ready");
  assert.match(session.attention[0]?.detail || "", /Choose an available faction/);
});

test("a host can transfer authority to another claimed human seat", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "standard-board", "horizon-base", 28002);
  let host = await service.create(game, "Original Host", "network");
  const guest = await service.join(host.code, 1, "Successor");
  host = await service.resume(host.code, host.token);
  const transferred = await executeRoomCommand(repository, { code: host.code, token: host.token, expectedRevision: host.revision, command: { kind: "transferHost", playerId: 1 } });
  assert.equal(transferred.ok, true);
  assert.equal(transferred.session?.role, "player");
  assert.equal((await service.resume(host.code, guest.token)).role, "host");
});

test("0.28.0 includes mobile lobby and gesture protections", async () => {
  const [board, gestures, shellCss, multiplayerCss, home] = await Promise.all([
    readFile("app/components/network/NetworkGameBoard.tsx", "utf8"),
    readFile("app/lib/use-map-gestures.ts", "utf8"),
    readFile("app/application-shell.css", "utf8"),
    readFile("app/multiplayer.css", "utf8"),
    readFile("app/page.tsx", "utf8"),
  ]);
  assert.match(board, /useMapGestures/);
  assert.match(gestures, /createMapGestures/);
  assert.match(shellCss, /height:100dvh/);
  assert.match(multiplayerCss, /data-room-status="lobby"/);
  assert.match(home, /quickCount = 4 \+ random\[0\] % 3/);
  assert.match(home, /compatibleMaps/);
});
