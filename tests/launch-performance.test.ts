import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createGame, projectedOrderBudget, MemoryRoomRepository, RoomService, type SecretOrder } from "../game/index";
import { createLocalRoom, forgetRoomIdentity, takeCreatedRoom } from "../app/lib/room-client";
import { ensureLocalBuild } from "../scripts/ensure-local-build.mjs";

test("launch handoff is private, one-use, and invalidated by forgetting the seat", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const service = new RoomService(new MemoryRoomRepository());
  const state = createGame(4, ["foundry", "helix", "varkesh", "farbound"], "standard-board");
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storageBefore = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const fetchBefore = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { value: { localStorage: storage }, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  globalThis.fetch = async () => Response.json(await service.create(state, "Test Commander", "local"));
  try {
    const session = await createLocalRoom(state);
    assert.equal(takeCreatedRoom("OTHER"), null);
    assert.deepEqual(takeCreatedRoom(session.code), session);
    assert.equal(takeCreatedRoom(session.code), null);
    for (const value of values.values()) assert.equal(JSON.parse(value).game, undefined);
    const second = await createLocalRoom(state);
    forgetRoomIdentity(second.code);
    assert.equal(takeCreatedRoom(second.code), null);
  } finally {
    globalThis.fetch = fetchBefore;
    if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore); else Reflect.deleteProperty(globalThis, "window");
    if (storageBefore) Object.defineProperty(globalThis, "localStorage", storageBefore); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("production launcher caches a build, rebuilds changed sources and replaced artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "horizon-launch-"));
  let builds = 0;
  await mkdir(join(root, "app"));
  await writeFile(join(root, "app/page.tsx"), "original");
  const build = async () => {
    builds++;
    await mkdir(join(root, "dist/client/assets"), { recursive: true });
    await mkdir(join(root, "dist/server"), { recursive: true });
    await writeFile(join(root, "dist/server/index.js"), `production build ${builds}`);
  };
  try {
    await ensureLocalBuild(root, build);
    await ensureLocalBuild(root, build);
    assert.equal(builds, 1);
    await writeFile(join(root, "app/page.tsx"), "updated");
    await ensureLocalBuild(root, build);
    assert.equal(builds, 2);
    await writeFile(join(root, "dist/server/index.js"), "different runtime");
    await ensureLocalBuild(root, build);
    assert.equal(builds, 3);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("failed production builds are never cached as ready", async () => {
  const root = await mkdtemp(join(tmpdir(), "horizon-launch-failed-"));
  try {
    await assert.rejects(ensureLocalBuild(root, async () => { throw new Error("build failed"); }), /build failed/);
    await assert.rejects(readFile(join(root, "dist/.horizon-local-build.json")), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("projected budget copies only changed Habitats and respects sequential capacity without mutating the game", () => {
  const state = createGame(4, ["helix", "foundry", "varkesh", "farbound"], "standard-board");
  const home = state.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  home.tier = "Outpost"; home.centers = [];
  state.players[0].tech.Resource = 2;
  state.players[0].resources = { material: 30, currency: 30, research: 30, influence: 30 };
  state.players[0].labor = 30;
  const orders: SecretOrder[] = [
    { id: "upgrade", kind: "construct", habitatId: home.id, construction: { type: "upgrade" } },
    { id: "research", kind: "construct", habitatId: home.id, construction: { type: "center", center: "research" } },
    { id: "material", kind: "construct", habitatId: home.id, construction: { type: "center", center: "material" } },
  ];
  const before = structuredClone(state);
  assert.equal(projectedOrderBudget(state, 0, orders).error, undefined);
  assert.match(projectedOrderBudget(state, 0, [...orders, { id: "overflow", kind: "construct", habitatId: home.id,
    construction: { type: "center", center: "currency" } }]).error || "", /Center slots/);
  assert.deepEqual(state, before);
  const budget = projectedOrderBudget(state, 0, []);
  budget.remaining.resources.material = 0;
  assert.equal(state.players[0].resources.material, 30);
});
