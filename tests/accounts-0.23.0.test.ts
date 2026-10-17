import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  AccountService,
  createGame,
  DiskAccountRepository,
  MemoryAccountRepository,
  MemoryRoomRepository,
  RoomService,
} from "../game/index";

const factions = ["farbound", "helix", "foundry", "meridian"] as const;

test("commander profiles store only a recovery-key hash and support lifecycle controls", async () => {
  const repository = new MemoryAccountRepository();
  const service = new AccountService(repository);
  const created = await service.create("  Pathfinder  ");
  assert.equal(created.account.displayName, "Pathfinder");
  assert.match(created.account.id, /^HZN-[A-Z2-9]{12}$/);
  assert.match(created.token, /^hzn_session_[A-Z2-9]{16}-[A-Z2-9]{16}-[A-Z2-9]{16}$/);
  assert.match(created.recoveryKey, /^hzn_recovery_[A-Z2-9]{16}-[A-Z2-9]{16}-[A-Z2-9]{16}$/);
  assert.equal("recoveryTokenHash" in created.account, false);
  assert.equal("subjectHash" in created.account, false);

  const stored = await repository.get(created.account.id);
  assert.ok(stored);
  assert.notEqual(stored.sessions[0].tokenHash, created.token);
  assert.equal((await service.resume(created.token)).id, created.account.id);
  assert.equal((await service.update(created.token, "Cartographer")).displayName, "Cartographer");
  await service.delete(created.token);
  await assert.rejects(() => service.resume(created.token), /not valid/);
});

test("disk commander profiles survive a repository restart without writing the recovery key", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-accounts-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const created = await new AccountService(new DiskAccountRepository(directory)).create("Archivist");
  const restarted = new AccountService(new DiskAccountRepository(directory));
  assert.equal((await restarted.resume(created.token)).displayName, "Archivist");
  const payload = await readFile(join(directory, `${created.account.id}.json`), "utf8");
  assert.equal(payload.includes(created.token), false);
  assert.match(payload, /"tokenHash":"[a-f0-9]{64}"/);
  assert.match(payload, /"recoveryTokenHash":"[a-f0-9]{64}"/);
  assert.equal(payload.includes(created.recoveryKey), false);
});

test("account-linked seats recover across devices and preserve host authority", async () => {
  const accounts = new AccountService(new MemoryAccountRepository());
  const hostAccount = await accounts.create("Host");
  const guestAccount = await accounts.create("Guest");
  const repository = new MemoryRoomRepository();
  const rooms = new RoomService(repository);
  const host = await rooms.create(
    createGame(4, [...factions], "shattered-reach", "horizon-base", 2300),
    "Host",
    "network",
    hostAccount.account.id,
  );
  const guest = await rooms.join(host.code, 1, "Guest", guestAccount.account.id);
  const oldGuestToken = guest.token;
  const recoveredGuest = await rooms.resumeByAccount(host.code, guestAccount.account.id);
  assert.equal(recoveredGuest.role, "player");
  assert.equal(recoveredGuest.playerId, 1);
  await assert.rejects(() => rooms.resume(host.code, oldGuestToken), /not valid/);

  const recoveredHost = await rooms.resumeByAccount(host.code, hostAccount.account.id);
  assert.equal(recoveredHost.role, "host");
  await assert.rejects(() => rooms.resume(host.code, host.token), /not valid/);
  assert.deepEqual((await repository.findByAccount(hostAccount.account.id)).map((room) => room.code), [host.code]);
  await assert.rejects(
    () => rooms.join(host.code, 2, "Duplicate", guestAccount.account.id),
    /already controls a seat/,
  );
});

test("eligible multiplayer results settle once and unlock faction emblems after three wins", async () => {
  const accountRepository = new MemoryAccountRepository();
  const accounts = new AccountService(accountRepository);
  const hostAccount = await accounts.create("Host");
  const guestAccount = await accounts.create("Guest");
  const roomRepository = new MemoryRoomRepository();
  const rooms = new RoomService(roomRepository);

  for (let gameNumber = 0; gameNumber < 3; gameNumber++) {
    const game = createGame(4, [...factions], "standard-board", "horizon-base", 3300 + gameNumber, [
      { kind: "human" }, { kind: "human" },
      { kind: "bot", profileId: "strategic-director" }, { kind: "bot", profileId: "strategic-director" },
    ]);
    const host = await rooms.create(game, "Host", "network", hostAccount.account.id);
    await rooms.join(host.code, 1, "Guest", guestAccount.account.id);
    const stored = (await roomRepository.get(host.code))!;
    stored.status = "complete";
    stored.game.gate = 99;
    stored.game.players[0].lp = 12 + gameNumber;
    stored.game.result = { gateSucceeded: true, winnerIds: [0], reason: "test", finalizedTurn: 16 };
    stored.updatedAt = new Date(Date.now() + gameNumber).toISOString();
    await roomRepository.put(stored);
    assert.equal((await accounts.settleCompletedRoom(stored)).settled, 2);
    assert.equal((await accounts.settleCompletedRoom(stored)).settled, 0);
  }

  const hostProfile = await accounts.resume(hostAccount.token);
  assert.equal(hostProfile.statistics.gamesCompleted, 3);
  assert.equal(hostProfile.statistics.wins, 3);
  assert.equal(hostProfile.statistics.winsByFaction.farbound, 3);
  assert.ok(hostProfile.emblems.unlocked.includes("farbound"));
  assert.equal((await accounts.selectEmblem(hostAccount.token, "farbound")).emblems.selected, "farbound");
  await assert.rejects(() => accounts.selectEmblem(guestAccount.token, "helix"), /not been unlocked/);
});
