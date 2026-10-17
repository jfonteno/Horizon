import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGame, createPlaytestReport, executeRoomCommand, MemoryRoomRepository, RoomService } from "../game/index";

const factions = ["varkesh", "helix", "foundry", "aurelians"] as const;

async function completedFixture() {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  const game = createGame(4, [...factions], "standard-board", "horizon-base", 32001, [
    { kind: "human" }, { kind: "human" },
    { kind: "bot", profileId: "strategic-director" }, { kind: "bot", profileId: "strategic-director" },
  ]);
  const host = await service.create(game, "Host", "network", "HZN-TESTACCOUNT2");
  const room = (await repository.get(host.code))!;
  room.game.result = { gateSucceeded: true, winnerIds: [0], reason: "Closed beta fixture complete.", finalizedTurn: 16 };
  room.status = "complete";
  room.revision++;
  await repository.put(room);
  return { repository, service, host: await service.resume(host.code, host.token) };
}

test("completed rooms accept private structured feedback and include it in reports", async () => {
  const { repository, service, host } = await completedFixture();
  const submitted = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: host.revision,
    commandId: "feedback-one",
    command: { kind: "submitFeedback", rating: 4, difficulty: 3, wouldPlayAgain: true, issueTags: ["interface", "balance"], note: "The conclusion was clear." },
  });
  assert.equal(submitted.ok, true, submitted.message);
  assert.equal(submitted.session?.feedback?.rating, 4);
  assert.deepEqual(submitted.session?.feedback?.issueTags, ["interface", "balance"]);

  const revised = await executeRoomCommand(repository, {
    code: host.code,
    token: host.token,
    expectedRevision: submitted.session!.revision,
    commandId: "feedback-two",
    command: { kind: "submitFeedback", rating: 5, difficulty: 2, wouldPlayAgain: true, issueTags: [], note: "Ready for another match." },
  });
  assert.equal(revised.session?.feedback?.rating, 5);
  const room = await service.authenticateHost(host.code, host.token);
  assert.equal(room.feedback.length, 1);
  const report = await createPlaytestReport(room);
  assert.equal(report.feedback.summary.responses, 1);
  assert.equal(report.feedback.summary.averageRating, 5);
  assert.equal(report.feedback.responses[0].note, "Ready for another match.");
  assert.equal(report.lifecycle.commandsAccepted, 2);
});

test("hosts can create a fresh rematch lobby without replacing the completed record", async () => {
  const { repository, service, host } = await completedFixture();
  const rematch = await service.createRematch(host.code, host.token, "HZN-TESTACCOUNT2");
  assert.notEqual(rematch.code, host.code);
  assert.equal(rematch.summary.status, "lobby");
  assert.deepEqual(rematch.summary.seats.map((seat) => seat.faction), [...factions]);
  assert.equal(rematch.summary.seats[0].ready, false);
  assert.equal(rematch.summary.seats[2].ready, true);
  assert.match(rematch.summary.recentEvents.at(-1)!.message, new RegExp(host.code));
  assert.equal((await service.getStoredRoom(host.code)).status, "complete");
  assert.equal((await repository.list()).length, 2);
});

test("0.32.0 exposes the game library, notification controls, feedback, and rematch surfaces", async () => {
  const [shell, endgame, board, attention, operations] = await Promise.all([
    readFile(new URL("../app/components/ApplicationShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/EndgameResults.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/network/NetworkGameBoard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/use-room-attention.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /My Games/);
  assert.match(shell, /Color-accessible markers/);
  assert.match(shell, /Proposal reminders/);
  assert.match(endgame, /CLOSED BETA FEEDBACK/);
  assert.match(endgame, /Create rematch lobby/);
  assert.match(board, /submitFeedback/);
  assert.match(attention, /notifyMessages/);
  assert.match(operations, /Open chat reports/);
});
