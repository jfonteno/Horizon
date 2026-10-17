import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { beginSecretOrders, createGame, drawHiddenChoices, executeRoomCommand, getNeighbors, mapLibrary, MemoryRoomRepository, resolveSecretOrders, RoomService, selectHiddenLegacy, submitSecretOrders, validateRoomCommand } from "../game/index";

test("0.27.0 routes every local launch path through the room Command Board", async () => {
  const home = await readFile("app/page.tsx", "utf8");
  const board = await readFile("app/components/network/NetworkGameBoard.tsx", "utf8");
  assert.match(home, /createLocalRoom/);
  assert.match(home, /launchLocalRoom\(createFirstHorizon/);
  assert.match(home, /launchLocalRoom\(createGame\(quickCount, quickFactions, quickMap/);
  assert.match(home, /router\.push\(`\/room\/\$\{session\.code\}`\)/);
  assert.match(board, /NetworkFirstHorizonGuide/);
  assert.match(board, /FactionAcademy/);
  assert.match(board, /mobile-primary/);
});

test("resolved Turns retain a structured public movement replay", () => {
  const game = createGame(4, ["farbound", "helix", "foundry", "aurelians"], "shattered-reach", "horizon-base", 27001);
  game.players.forEach((player) => {
    drawHiddenChoices(game, player.id, game.era);
    selectHiddenLegacy(game, player.id, player.hiddenLegacy[game.era].choices[0]);
  });
  beginSecretOrders(game);
  const carrier = game.carriers.find((candidate) => candidate.owner === 0)!;
  const origin = carrier.hex;
  const destination = getNeighbors(origin, mapLibrary[game.mapId]).find((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "rift")!;
  game.hexes.find((hex) => hex.id === destination)!.revealed = true;
  assert.equal(submitSecretOrders(game, 0, [{ id: "move", kind: "carrierMove", carrierIds: [carrier.id], destination, path: [origin, destination] }]).ok, true);
  for (const player of game.players.slice(1)) assert.equal(submitSecretOrders(game, player.id, []).ok, true);
  assert.equal(resolveSecretOrders(game).ok, true);
  const replay = game.turnReplays?.at(-1);
  assert.equal(replay?.turn, 1);
  assert.equal(replay?.movements[0]?.fromHexId, origin);
  assert.equal(replay?.movements[0]?.toHexId, destination);
  assert.equal(replay?.movements[0]?.outcome, "completed");
  assert.equal(replay?.factions.length, 4);
});

test("local pass-and-play advances private seats through the room command path", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const session = await service.create(createGame(4, ["farbound", "helix", "foundry", "aurelians"], "shattered-reach", "horizon-base", 27002), "Local Commander", "local");
  let current = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "drawHidden" } })).session!;
  current = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: current.revision, command: { kind: "selectHidden", cardId: current.game.players[0].hiddenLegacy[1].choices[0] } })).session!;
  current = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: current.revision, command: { kind: "submitOrders", orders: [] } })).session!;
  assert.equal(current.summary.mode, "local");
  assert.equal(current.playerId, 1);
  assert.equal(current.game.orderProtocol.submissions[0]?.playerId, 0);
});

test("0.27.0 exposes replay, public status, synchronized drafts, and 48-hour timers", async () => {
  const sources = await Promise.all([
    "app/components/network/TurnReplayOverlay.tsx",
    "app/components/network/FactionStatusOverlay.tsx",
    "app/components/network/NetworkGameBoard.tsx",
    "game/server/turn-timer.ts",
  ].map((path) => readFile(path, "utf8")));
  const source = sources.join("\n");
  for (const phrase of ["Previous Orders", "Combat Units", "Horizon Gate", "saveDraft", "draftedPlayerIds", "turnReplays"])
    assert.match(source, new RegExp(phrase));
  const maximumTimer = validateRoomCommand({ kind: "setTurnTimer", seconds: 172800 });
  assert.equal(maximumTimer.kind === "setTurnTimer" ? maximumTimer.seconds : null, 172800);
  assert.throws(() => validateRoomCommand({ kind: "setTurnTimer", seconds: 172801 }), /48 hours/);
});

test("0.27.0 packages a dedicated active-board background and menu soundtrack", async () => {
  const shell = await readFile("app/components/ApplicationShell.tsx", "utf8");
  const theme = await readFile("app/themes/horizon-base.css", "utf8");
  assert.match(shell, /<LobbySoundtrack/);
  assert.match(theme, /--board-backdrop/);
  await readFile("public/themes/horizon-base/horizon-command-board-0.27.0.png");
});
