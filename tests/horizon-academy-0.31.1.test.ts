import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  academyScenarios,
  advanceAcademy,
  availableFactionsForHost,
  constructionQuote,
  createFactionAcademy,
  createGame,
  executeRoomCommand,
  expansionForFaction,
  factionIds,
  legacyObjectiveProgress,
  ownsExpansion,
  playtestEntitlements,
  recordAcademyCommand,
  recordAcademyPanel,
  MemoryRoomRepository,
  RoomService,
  restartAcademyStage,
  resolveShatteredOrders,
  syncAcademy,
  getNeighbors,
  mapLibrary,
} from "../game";

test("0.33.3 provides a three-stage Horizon Academy scenario for every playable faction", () => {
  assert.equal(factionIds.length, 11);
  for (const factionId of factionIds) {
    const scenario = academyScenarios[factionId];
    assert.equal(scenario.factionId, factionId);
    assert.deepEqual(scenario.stages.map((stage) => stage.id), ["foundation", "signature", "mastery"]);
    assert.ok(scenario.stages.every((stage) => stage.checklist.length === 3 && stage.panel));
    const game = createFactionAcademy(factionId);
    assert.equal(game.scenarioId, "faction-academy");
    assert.equal(game.players[0].faction, factionId);
    assert.equal(game.academy?.stage, 0);
    assert.equal(game.players[0].hiddenLegacy[1].selected !== undefined, true);
  }
});

test("Spires mastery stages a legal Metropolis to Arcology Habitat Upgrade", () => {
  const game = createFactionAcademy("spires");
  advanceAcademy(game);
  advanceAcademy(game);
  const home = game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === 0)!;
  assert.equal(home.tier, "Metropolis");
  const quote = constructionQuote(game, 0, home.id, { type: "arcology" });
  assert.equal(quote.available, true);
  assert.equal(quote.label, "Habitat Upgrade: Arcology");
});

test("Academy stages jump to prepared early, middle, and late positions before free practice", () => {
  const game = createFactionAcademy("wayfarers");
  assert.equal(game.turn, 1);
  assert.equal(game.mobileHabitats.some((unit) => unit.owner === 0 && unit.type === "arkship"), true);
  assert.equal(advanceAcademy(game), true);
  assert.equal(game.turn, 7);
  assert.equal(game.players[0].tech.Exploration, 2);
  assert.equal(restartAcademyStage(game), true);
  assert.equal(game.turn, 7);
  assert.equal(advanceAcademy(game), true);
  assert.equal(game.turn, 13);
  assert.equal(game.players[0].tech.Military, 4);
  assert.equal(game.mobileHabitats.some((unit) => unit.type === "worldship"), true);
  assert.equal(advanceAcademy(game), true);
  assert.equal(game.academy?.completed, true);
  assert.equal(game.academy?.freePractice, true);
});

test("all eleven Academy courses naturally progress from panel exploration through resolved faction actions", () => {
  type AcademyCommand = Parameters<typeof recordAcademyCommand>[1];
  const commands: Record<string, [AcademyCommand | null, AcademyCommand, AcademyCommand]> = {
    varkesh: [
      { kind: "submitOrders", orders: [{ id: "build", kind: "construct", habitatId: "2-0", construction: { type: "carrier", carrier: "patrol" } }] },
      { kind: "submitOrders", orders: [{ id: "fleet", kind: "carrierMove", carrierIds: ["carrier-0-1"], destination: "2-1" }] },
      { kind: "submitOrders", orders: [{ id: "conquest", kind: "carrierMove", carrierIds: ["carrier-0-1"], destination: "2-1" }] },
    ],
    helix: Array(3).fill(null).map((_, index) => ({ kind: index === 2 ? "proposeTechnology" : "submitOrders", orders: index === 2 ? undefined : [{ id: `tech-${index}`, kind: "technology", branch: "Resource" }] })) as [AcademyCommand, AcademyCommand, AcademyCommand],
    foundry: [
      { kind: "submitOrders", orders: [{ id: "center", kind: "construct", habitatId: "2-0", construction: { type: "center", center: "material" } }] },
      { kind: "submitOrders", orders: [{ id: "prospect", kind: "prospect", unitId: "academy-prospector" }] },
      { kind: "submitOrders", orders: [{ id: "industry", kind: "construct", habitatId: "2-0", construction: { type: "center", center: "currency" } }] },
    ],
    aurelians: [{ kind: "proposeAgreement" }, { kind: "politicalCapital" }, { kind: "proposeAgreement" }],
    meridian: [{ kind: "proposeTrade" }, { kind: "brokerTrade" }, { kind: "economicSalvage" }],
    farbound: [
      { kind: "submitOrders", orders: [{ id: "forward", kind: "farboundForwardScan", vesselId: "explorer-0", hexId: "2-1" }] },
      { kind: "surveyExchange" },
      { kind: "submitOrders", orders: [{ id: "long", kind: "longRangeSurvey", unitId: "explorer-0", hexId: "2-1" }] },
    ],
    spires: [
      { kind: "submitOrders", orders: [{ id: "upgrade", kind: "construct", habitatId: "2-0", construction: { type: "upgrade" } }] },
      { kind: "submitOrders", orders: [{ id: "defense", kind: "construct", habitatId: "2-0", construction: { type: "center", center: "defense" } }] },
      { kind: "submitOrders", orders: [{ id: "arcology", kind: "construct", habitatId: "2-0", construction: { type: "arcology" } }] },
    ],
    aegis: [
      { kind: "submitOrders", orders: [{ id: "guard", kind: "carrierMove", carrierIds: ["carrier-0-1"], destination: "2-1" }] },
      { kind: "submitOrders", orders: [{ id: "blockade", kind: "construct", habitatId: "2-0", construction: { type: "blockade" } }] },
      { kind: "proposeBlockadeSale" },
    ],
    wayfarers: [
      { kind: "submitOrders", orders: [{ id: "mobile-center", kind: "construct", habitatId: "2-0", construction: { type: "mobileCenter", mobileHabitatId: "mobile-0-1", center: "currency" } }] },
      { kind: "submitOrders", orders: [{ id: "migration", kind: "migration", mobileHabitatId: "mobile-0-1", destination: "2-1" }] },
      { kind: "submitOrders", orders: [{ id: "guard", kind: "construct", habitatId: "2-0", construction: { type: "caravanGuard", mobileHabitatId: "academy-worldship" } }] },
    ],
    salvo: Array(3).fill(null).map((_, index) => ({ kind: "submitOrders", orders: [{ id: `bombard-${index}`, kind: "bombard", carrierId: "carrier-0-1", targetHexId: "2-1", targetPlayerId: 1 }] })) as [AcademyCommand, AcademyCommand, AcademyCommand],
    guilds: [
      null,
      { kind: "submitOrders", orders: [{ id: "enhance", kind: "construct", habitatId: "2-0", construction: { type: "enhanceCenter", centerIndex: 1 } }] },
      { kind: "submitOrders", orders: [{ id: "factory", kind: "factoryOutput", habitatId: "2-0", factoryIndex: 2, output: "material" }] },
    ],
  };
  for (const factionId of factionIds) {
    const game = createFactionAcademy(factionId);
    const panel = academyScenarios[factionId].stages[0].panel === "faction" ? "academy" : academyScenarios[factionId].stages[0].panel;
    recordAcademyPanel(game, panel);
    const foundation = commands[factionId][0];
    if (foundation) {
      recordAcademyCommand(game, foundation);
      if (foundation.orders) game.turn++;
    }
    assert.equal(syncAcademy(game), true, `${factionId} Foundation should progress from its guided opening action`);
    assert.equal(game.academy?.stage, 1);
    assert.ok(game.players.every((player) => player.hiddenLegacy[game.era]?.selected), `${factionId} middle exercise must not be blocked by Hidden Legacy`);
    recordAcademyCommand(game, commands[factionId][1]);
    if (commands[factionId][1].orders) game.turn++;
    assert.equal(syncAcademy(game), true, `${factionId} signature exercise should progress from its faction action`);
    assert.equal(game.academy?.stage, 2);
    assert.ok(game.players.every((player) => player.hiddenLegacy[game.era]?.selected), `${factionId} mastery exercise must not be blocked by Hidden Legacy`);
    recordAcademyPanel(game, "legacy");
    recordAcademyCommand(game, commands[factionId][2]);
    if (commands[factionId][2].orders) game.turn++;
    assert.equal(syncAcademy(game), true, `${factionId} mastery should graduate after Legacy review and an advanced action`);
    assert.equal(game.academy?.freePractice, true);
  }
});

test("authoritative Academy commands automatically advance a Wayfarer course without skip controls", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let session = await service.create(createFactionAcademy("wayfarers"), "Learner", "local");
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "academyEvent", event: "panel-opened", value: "build" } })).session!;
  assert.equal(session.game.academy?.stage, 0);
  const openingMobile = session.game.mobileHabitats.find((unit) => unit.owner === 0)!;
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "submitOrders", orders: [{ id: "academy-mobile-center", kind: "construct", habitatId: openingMobile.hex, construction: { type: "mobileCenter", mobileHabitatId: openingMobile.id, center: "currency" } }] } })).session!;
  assert.equal(session.game.academy?.stage, 1);
  const mobile = session.game.mobileHabitats.find((unit) => unit.owner === 0)!;
  const firstTarget = getNeighbors(mobile.hex, mapLibrary[session.game.mapId]).map((id) => session.game.hexes.find((hex) => hex.id === id)!).find((hex) => hex.revealed && hex.kind !== "rift")!;
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "submitOrders", orders: [{ id: "academy-migration-1", kind: "migration", mobileHabitatId: mobile.id, destination: firstTarget.id }] } })).session!;
  assert.equal(session.game.academy?.stage, 2);
  assert.equal(session.game.turn, 13);
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "academyEvent", event: "panel-opened", value: "legacy" } })).session!;
  const worldship = session.game.mobileHabitats.find((unit) => unit.owner === 0 && unit.type === "worldship")!;
  session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "submitOrders", orders: [{ id: "academy-caravan-guard", kind: "construct", habitatId: worldship.hex, construction: { type: "caravanGuard", mobileHabitatId: worldship.id } }] } })).session!;
  assert.equal(session.game.academy?.completed, true);
  assert.equal(session.game.academy?.freePractice, true);
});

test("Salvo mastery prepares a legal Siege Tender coordination shot", () => {
  const game = createFactionAcademy("salvo");
  advanceAcademy(game);
  advanceAcademy(game);
  const gun = game.carriers.find((unit) => unit.owner === 0 && unit.type === "bombardFrigate")!;
  const target = game.carriers.find((unit) => unit.owner === 1)!;
  assert.equal(game.carriers.some((unit) => unit.owner === 0 && unit.type === "siegeTender"), true);
  assert.equal(getNeighbors(gun.hex, mapLibrary[game.mapId]).includes(target.hex), false);
  const before = target.cu;
  resolveShatteredOrders(game, [{ playerId: 0, order: { id: "academy-coordinated-shot", kind: "bombard", carrierId: gun.id, targetHexId: target.hex, targetPlayerId: 1 } }]);
  assert.ok(target.cu < before);
});

test("expansion access supports offline playtest verification and the host-enabled room policy", () => {
  const entitlements = playtestEntitlements(new Date("2026-10-02T00:00:00.000Z"));
  assert.equal(ownsExpansion(entitlements, "shattered-reach-expansion", Date.parse("2026-10-03T00:00:00.000Z")), true);
  assert.equal(expansionForFaction("salvo"), "shattered-reach-expansion");
  assert.equal(expansionForFaction("foundry"), undefined);
  assert.equal(availableFactionsForHost([]).includes("salvo"), false);
  const enabled = availableFactionsForHost(["shattered-reach-expansion"]);
  assert.equal(enabled.includes("salvo"), true);
  assert.equal(enabled.includes("foundry"), true);
});

test("every packaged faction can be selected through an expansion-enabled room lobby", async () => {
  const repository = new MemoryRoomRepository();
  const service = new RoomService(repository);
  let session = await service.create(createGame(4, ["spires", "varkesh", "helix", "foundry"], "shattered-reach", "horizon-base", 31102), "Host", "network");
  assert.deepEqual(new Set(session.summary.availableFactions.map((faction) => faction.id)), new Set(factionIds));
  for (const factionId of factionIds) {
    session = (await executeRoomCommand(repository, { code: session.code, token: session.token, expectedRevision: session.revision, command: { kind: "selectFaction", factionId } })).session!;
    assert.equal(session.summary.seats[0].faction, factionId);
  }
});

test("Shattered Reach Legacy objectives expose exact compound progress", () => {
  const game = createGame(2, ["spires", "aegis"], "shattered-reach", "horizon-base", 31101);
  const urban = legacyObjectiveProgress(game, 0, "sp-urban");
  const fortress = legacyObjectiveProgress(game, 1, "ae-fortress");
  assert.match(urban.label, /Cities \d+\/2 · economic Centers \d+\/4/);
  assert.match(fortress.label, /Protected Habitats \d+\/3/);
  assert.doesNotMatch(urban.label, /Tracked automatically/);
});

test("Academy launch, board assets, and artillery preview are present in the command UI", async () => {
  const shell = await readFile(new URL("../app/components/ApplicationShell.tsx", import.meta.url), "utf8");
  const board = await readFile(new URL("../app/components/network/NetworkGameBoard.tsx", import.meta.url), "utf8");
  const reach = await readFile(new URL("../app/components/ShatteredReachPanel.tsx", import.meta.url), "utf8");
  const build = await readFile(new URL("../app/components/BuildPanel.tsx", import.meta.url), "utf8");
  const guide = await readFile(new URL("../app/components/network/NetworkAcademyGuide.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(shell, /Horizon Academy/);
  assert.match(shell, /startFactionTraining/);
  assert.match(board, /mobile-habitat/);
  assert.match(board, /blockade-marker/);
  assert.match(board, /Select \$\{game\.players\[mobile\.owner\]\.name\}/);
  assert.match(board, /selectedReachAssetId/);
  assert.match(board, /enhanced-centers/);
  assert.match(reach, /Supported by/);
  assert.match(reach, /No legal targets in the current range preview/);
  assert.match(build, /player\.faction === "spires"/);
  assert.match(build, /construction: \{ type: "arcology" \}/);
  assert.match(build, /Resource IV Habitat Upgrade/);
  assert.doesNotMatch(build, /group: "Shattered Reach"/);
  assert.match(guide, /className="academy-guide-actions"/);
  for (const label of ["Restart", "Enter practice", "Skip", "Hide guide"]) assert.match(guide, new RegExp(label));
  assert.match(styles, /\.network-academy-guide \.academy-guide-actions \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
