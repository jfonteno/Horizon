import { createGame } from "./engine/create-game";
import { getNeighbors } from "./engine/geometry";
import { factionIds, factionLibrary, type FactionId } from "./factions";
import { mapLibrary } from "./maps";
import { refreshContacts } from "./rules/diplomacy";
import { drawHiddenChoices, selectHiddenLegacy } from "./rules/legacy";
import type { AcademyStageId, GameState, TechnologyBranch } from "./types";
import type { ThemeId } from "./themes";

export type AcademyStageDefinition = {
  id: AcademyStageId;
  eyebrow: string;
  title: string;
  body: string;
  objective: string;
  checklist: string[];
  completion: string;
  panel: string;
  turn: number;
  technologyLevel: number;
};

export type AcademyScenarioDefinition = {
  factionId: FactionId;
  duration: string;
  identity: string;
  stages: AcademyStageDefinition[];
};

export type AcademyRequirementProgress = {
  id: string;
  label: string;
  complete: boolean;
};

const lessons: Record<string, [string, string, string, string, string, string]> = {
  varkesh: ["Fleet economy", "Use the Varkesh vessel discount to assemble a credible force.", "Rapid advance", "Move a concentrated fleet through the teaching front and compare deterministic strength.", "Glory through conquest", "Win on hostile ground, capture a Habitat, and review how Glory converts aggression into Legacy."],
  helix: ["Research efficiency", "Advance Technology while preserving resources for the rest of your plan.", "Breadth of knowledge", "Build across several branches and compare the Helix research curve with a standard civilization.", "Knowledge exchange", "Prepare a high-level technology and use diplomacy to turn research leadership into value."],
  foundry: ["Industrial foundation", "Build a Habitat Module and develop the material worlds around your Homeworld.", "Prospector operations", "Deploy a Prospector and improve an undeveloped resource sector.", "Engine of construction", "Use industrial Centers and Foundry discounts to complete a dense late-game build plan."],
  aurelians: ["First accord", "Contact another civilization and establish a useful agreement.", "Political Capital", "Convert diplomatic reach into the resource your current plan needs.", "Envoy network", "Station Envoys, maintain several agreements, and use influence as a strategic engine."],
  meridian: ["Trade routes", "Complete a direct trade that improves both civilizations without empty exchanges.", "Brokerage", "Arrange an exchange between two other civilizations and collect the Meridian advantage.", "Economic Salvage", "Recover value from a constrained late-game economy, then redirect it into the Gate or Legacy."],
  farbound: ["Survey frontier", "Use Exploration Vessels to reveal nearby sectors and preserve useful private information.", "Sell the map", "Exchange survey intelligence with another civilization during negotiation.", "Settle what you know", "Use surveyed settlement and long-range exploration to establish a distant Habitat efficiently."],
  spires: ["Concentrated growth", "Develop a small number of Habitats into a dense urban core.", "Defense Grid", "Construct active defenses and compare a fortified Habitat with an exposed one.", "Arcology", "Complete an Arcology and review the exact progress toward the Spires urban Legacy path."],
  aegis: ["Guard the line", "Position military assets to protect a friendly Habitat and understand defensive strength.", "Grid and Blockade", "Construct a Defense Grid and Blockade, then inspect their separate capture rules.", "Defensive transfer", "Use Aegis infrastructure away from home and coordinate protection with another civilization."],
  wayfarers: ["Life aboard", "Inspect your Arkship, its mobile Centers, and how it extracts 1 resource from the world beneath it.", "Migration", "Declare a Migration Order, validate the destination, and redeploy without an intermediate state.", "Caravan civilization", "Coordinate a Grand Ark or Worldship with Gunnery Platforms and Caravan Guards."],
  salvo: ["Artillery doctrine", "Select an artillery vessel, inspect legal targets, and prepare ammunition.", "Controlled bombardment", "Bombard without exceeding the per-target damage limit and review the resulting marker.", "Fire Coordination", "Use a Siege Tender to extend range or clear one friendly obstruction without increasing damage."],
  guilds: ["Enhanced production", "Inspect the starting Enhanced Center and compare its output with a normal Center.", "Labor investment", "Enhance another Center while balancing Labor against current production.", "Factory network", "Operate Factories and concentrated Enhanced Centers to execute a flexible late-game production plan."],
};

const guidance: Record<string, [string[], string[], string[]]> = {
  varkesh: [
    ["Open Build and select your Homeworld.", "Queue a discounted military vessel or recruit Combat Units.", "Open Orders, review the queued cost, then seal Orders."],
    ["Open Military and select a Varkesh carrier on the map.", "Choose Move, then select one of the highlighted destination hexes.", "Keep your force concentrated, seal Orders, and review the combat-strength result."],
    ["Open Legacy and note your current Glory progress.", "Move your stronger task force into the staged hostile Habitat.", "Seal Orders, resolve the battle, then reopen Legacy to see the Glory result."],
  ],
  helix: [
    ["Open Technology and compare the discounted Helix cost with your resources.", "Choose an affordable branch and add the advance to Orders.", "Open Orders and seal the Technology advance."],
    ["Open Technology and review your staged branch levels.", "Queue an advance in a second branch to practice Helix breadth.", "Seal Orders and compare the remaining Research with a normal advance cost."],
    ["Open Diplomacy and select a civilization with a lower Technology level.", "In Helix Technology Exchange, choose the branch and optional compensation.", "Send the offer and review the accepted exchange in negotiation history."],
  ],
  foundry: [
    ["Open Build and select your Homeworld.", "Queue a Habitat Module, Center, or Foundry industrial unit.", "Open Orders, check the Foundry discount, and seal the build."],
    ["Select the staged Prospector, then open Build.", "Choose Prospect for the highlighted undeveloped resource sector.", "Seal Orders and inspect the improved sector after resolution."],
    ["Open Build and select a developed Habitat.", "Queue at least one industrial Center and one discounted construction.", "Seal Orders and compare the resulting production network."],
  ],
  aurelians: [
    ["Open Diplomacy and select a contacted civilization.", "Choose a Formal Agreement both sides can afford.", "Send the proposal and review its status in Incoming or Outgoing Proposals."],
    ["Open Diplomacy and find Political Capital.", "Choose Currency, Material, or Labor based on your staged shortage.", "Confirm the conversion and inspect the changed resource total."],
    ["Open Build and queue an Envoy if one is not already available.", "Open Diplomacy, create agreements, and enable Envoy hosting permission.", "Station the Envoy at the partner Habitat, then review your Aurelian Legacy progress."],
  ],
  meridian: [
    ["Open Diplomacy and select a contacted civilization.", "Enter something you give and something you request in Direct Trade.", "Send the proposal and review the result in negotiation history."],
    ["Open Diplomacy and find Meridian Brokerage.", "Choose two different civilizations and the resource each gives.", "Broker the exchange and inspect your Meridian benefit in the activity log."],
    ["Open Economy and review the staged resource shortage.", "Use Economic Salvage once, then inspect the resources returned.", "Redirect the recovered value into a build, Gate Tribute, or Legacy plan."],
  ],
  farbound: [
    ["Select an Exploration Vessel on the map.", "Choose Farbound Forward Scan and select a highlighted unrevealed sector.", "Seal Orders, then inspect the private survey information after resolution."],
    ["Open Diplomacy and use Negotiation Survey on an unrevealed sector.", "Select the gathered survey under Survey Exchange and set a Currency price.", "Sell it to the selected civilization and review the exchange result."],
    ["Open Orders and select Long-Range Survey or a Farbound settlement action.", "Choose the staged distant legal target shown by the map highlight.", "Seal Orders and inspect the revealed or settled sector after resolution."],
  ],
  spires: [
    ["Open Build and select your Homeworld.", "Add economic Centers or upgrade the Habitat while keeping development concentrated.", "Seal Orders and inspect the total Centers across your urban core."],
    ["Open Build and select a staged Spires Habitat with an open slot.", "Queue a Defense Grid and seal Orders.", "After resolution, select the Habitat and compare its fortified defense value."],
    ["Open Legacy and read the exact Arcology Civilization progress.", "Open Build, select the staged Metropolis, and queue an Arcology.", "Resolve the build, then reopen Legacy to confirm the objective update."],
  ],
  aegis: [
    ["Open Military and select the staged Aegis carrier.", "Choose Move and send it to the highlighted friendly Habitat.", "Seal Orders, then inspect how its strength changes while defending friendly territory."],
    ["Open Build and select the staged Habitat.", "Queue an Aegis Defense Grid or build a Blockade at Military II, then seal Orders.", "Next Turn, select any military vessel in that hex and choose Load Blockade. The Blockade Deployment Vessel can carry 3."],
    ["Advance to Economy II, then open Diplomacy and select a buyer eligible for direct trade.", "Find Commission an Aegis Blockade, set a fee, and send the offer without constructing a Blockade first.", "The buyer pays the construction cost plus your fee and chooses a controlled destination hex when accepting."],
  ],
  wayfarers: [
    ["Select the Arkship marker and inspect its deployed status, open Center slot, and Mobile Extraction ability.", "Open Build, select the Arkship's hex, and queue a Mobile Center.", "Seal Orders, then compare the new Center's output with the separate 1-resource planet extraction."],
    ["Open Orders and find the Arkship under Shattered Reach abilities.", "Choose Migrate, then select one of the legal adjacent destinations.", "Seal Orders and confirm that the Arkship packed, moved, and redeployed in one resolution."],
    ["Open Military and inspect the staged Gunnery Platform beside the mobile Habitat.", "Open Build or Orders and add a Caravan Guard or another mobile asset.", "Resolve the action, then compare the caravan's defended strength with its normal strength."],
  ],
  salvo: [
    ["Select the Bombard Frigate on the map.", "Choose Bombard a highlighted hex in the selected-vessel controls.", "Review the highlighted legal target hexes, then cancel or queue the shot."],
    ["Select the Bombard Frigate and choose Bombard a highlighted hex.", "Select the highlighted hostile hex, not an individual vessel.", "Seal Orders and inspect which force automatically took damage first."],
    ["Select the Bombard Frigate beside the staged Siege Tender.", "Choose the highlighted target two hexes away. Fire Coordination supplies the extra range.", "Seal Orders and confirm that damage stayed unchanged and the Tender supported only one shot."],
  ],
  guilds: [
    ["Open Economy and inspect the marked Enhanced Center.", "Compare its output with a normal Center and note your Labor cap.", "Select its Habitat to see the enhanced-center marker in context."],
    ["Open Build and select a Habitat with a normal economic Center.", "Choose Enhance Center and check the projected Labor reduction.", "Seal Orders and confirm the Center is enhanced without lowering Labor below 1."],
    ["Open Orders and find the staged Factory under Shattered Reach abilities.", "Choose Material, Currency, or Research as next Production's output.", "Seal Orders, then review Legacy progress and the Factory's locked output."],
  ],
};

const completionLabels: Record<string, [string, string, string]> = {
  varkesh: ["Open Build and inspect the Varkesh fleet discount", "Resolve a Varkesh fleet movement or construction", "Open Legacy and resolve a Glory-building action"],
  helix: ["Open Technology and inspect the Helix research discount", "Resolve a Helix Technology advance", "Open Legacy and complete a Technology Exchange"],
  foundry: ["Open Build and inspect Foundry construction", "Resolve a Prospect or industrial construction action", "Open Legacy and resolve an advanced Foundry build"],
  aurelians: ["Open Diplomacy and inspect agreements", "Use Political Capital or another Aurelian signature action", "Open Legacy and resolve an advanced Aurelian action"],
  meridian: ["Open Diplomacy and inspect Direct Trade", "Complete Brokerage or another Meridian trade action", "Open Legacy and use Economic Salvage"],
  farbound: ["Open the map and inspect an Exploration Vessel", "Complete a survey or Survey Exchange", "Open Legacy and resolve an advanced Farbound action"],
  spires: ["Open Build and inspect concentrated development", "Resolve a Defense Grid or Habitat upgrade", "Open Legacy and resolve an Arcology construction"],
  aegis: ["Open Military and resolve a defensive fleet move", "Resolve a Defense Grid or Blockade construction", "Open Legacy and offer a Blockade commission"],
  wayfarers: ["Open Build and resolve a Mobile Center construction", "Resolve a Migration Order", "Open Legacy and resolve a caravan construction"],
  salvo: ["Open Military and inspect a Bombard Frigate", "Resolve a Bombardment", "Open Legacy and resolve a Siege Tender-supported Bombardment"],
  guilds: ["Open Economy and inspect Enhanced production", "Resolve an Enhance Center construction", "Open Legacy and resolve Factory Output"],
};

function stage(factionId: string, id: AcademyStageId, index: number, pair: [string, string], panel: string): AcademyStageDefinition {
  const names = ["FOUNDATION", "SIGNATURE ABILITY", "MASTERY"];
  return {
    id,
    eyebrow: `HORIZON ACADEMY · ${names[index]}`,
    title: pair[0],
    body: pair[1],
    objective: index === 0 ? "Learn the faction's opening priorities." : index === 1 ? "Practice the faction's defining rule." : "Combine the faction's tools in a prepared late-game position.",
    checklist: guidance[factionId]?.[index] || ["Inspect the prepared position", "Use the highlighted faction action", "Review the result"],
    completion: completionLabels[factionId]?.[index] || "Complete the staged faction action",
    panel,
    turn: index === 0 ? 1 : index === 1 ? 7 : 13,
    technologyLevel: index === 0 ? 1 : index === 1 ? 2 : 4,
  };
}

const panels: Record<string, [string, string, string]> = {
  varkesh: ["build", "military", "legacy"], helix: ["technology", "technology", "diplomacy"],
  foundry: ["build", "build", "build"], aurelians: ["diplomacy", "diplomacy", "diplomacy"],
  meridian: ["diplomacy", "diplomacy", "economy"], farbound: ["map", "diplomacy", "orders"],
  spires: ["build", "build", "legacy"], aegis: ["military", "build", "diplomacy"],
  wayfarers: ["build", "orders", "military"], salvo: ["military", "orders", "military"],
  guilds: ["economy", "build", "economy"],
};

const signatureEvents: Record<string, string[]> = {
  varkesh: ["order:carrierMove", "order:construct:carrier", "order:construct:recruit"],
  helix: ["order:technology", "command:proposeTechnology"],
  foundry: ["order:prospect", "order:construct:center", "order:construct:civilian"],
  aurelians: ["command:politicalCapital", "command:proposeAgreement", "order:construct:civilian"],
  meridian: ["command:proposeTrade", "command:brokerTrade", "command:economicSalvage"],
  farbound: ["command:negotiationSurvey", "command:surveyExchange", "order:farboundForwardScan", "order:longRangeSurvey"],
  spires: ["order:construct:defense", "order:construct:arcology", "order:construct:upgrade"],
  aegis: ["order:construct:defense", "order:construct:blockade", "order:transferBlockade", "command:proposeBlockadeSale", "command:proposeBlockadeCommission"],
  wayfarers: ["order:migration", "order:construct:mobileHabitat", "order:construct:mobileCenter", "order:construct:caravanGuard"],
  salvo: ["order:bombard", "order:construct:carrier"],
  guilds: ["order:construct:enhanceCenter", "order:construct:factory", "order:factoryOutput"],
};

const exerciseEvents: Record<string, [string[], string[], string[]]> = {
  varkesh: [["order:construct:carrier", "order:construct:recruit"], ["order:carrierMove"], ["order:carrierMove"]],
  helix: [["order:technology"], ["order:technology"], ["command:proposeTechnology"]],
  foundry: [["order:construct:module", "order:construct:center", "order:construct:civilian"], ["order:prospect"], ["order:construct:center", "order:construct:civilian"]],
  aurelians: [["command:proposeAgreement"], ["command:politicalCapital"], ["command:proposeAgreement", "order:construct:civilian"]],
  meridian: [["command:proposeTrade"], ["command:brokerTrade"], ["command:economicSalvage"]],
  farbound: [["order:farboundForwardScan"], ["command:surveyExchange"], ["order:longRangeSurvey"]],
  spires: [["order:construct:upgrade"], ["order:construct:defense"], ["order:construct:arcology"]],
  aegis: [["order:carrierMove"], ["order:construct:defense", "order:construct:blockade"], ["command:proposeBlockadeCommission", "order:transferBlockade", "command:proposeBlockadeSale"]],
  wayfarers: [["order:construct:mobileCenter"], ["order:migration"], ["order:construct:mobileHabitat", "order:construct:caravanGuard"]],
  salvo: [["order:bombard"], ["order:bombard"], ["order:bombard"]],
  guilds: [[], ["order:construct:enhanceCenter"], ["order:factoryOutput"]],
};

export const academyScenarios: Record<string, AcademyScenarioDefinition> = Object.fromEntries(factionIds.map((factionId) => {
  const copy = lessons[factionId] || ["Foundation", "Learn the opening position.", "Signature ability", "Practice the defining ability.", "Mastery", "Combine the faction's tools."];
  const destinations = panels[factionId] || ["map", "orders", "legacy"];
  return [factionId, {
    factionId,
    duration: "15 to 25 minutes",
    identity: factionLibrary[factionId].blurb,
    stages: [
      stage(factionId, "foundation", 0, [copy[0], copy[1]], destinations[0]),
      stage(factionId, "signature", 1, [copy[2], copy[3]], destinations[1]),
      stage(factionId, "mastery", 2, [copy[4], copy[5]], destinations[2]),
    ],
  }];
}));

function home(game: GameState, playerId: number) {
  return game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === playerId)!;
}

function prepareAcademyStage(game: GameState, stageIndex: number) {
  const progress = game.academy;
  if (!progress) return;
  const definition = academyScenarios[progress.factionId];
  const exercise = definition.stages[stageIndex];
  const player = game.players[0];
  game.turn = exercise.turn;
  game.era = Math.floor((exercise.turn - 1) / 4) + 1;
  game.active = 0;
  game.selected = home(game, 0).id;
  game.orderProtocol = { phase: "negotiation", turn: game.turn, currentPlayer: 0, submissions: [], lastResolution: [] };
  progress.stageStartedTurn = game.turn;
  progress.stageEvents = [];
  player.resources = stageIndex === 0
    ? { material: 5, currency: 5, research: 4, influence: 4 }
    : stageIndex === 1
      ? { material: 10, currency: 10, research: 9, influence: 8 }
      : { material: 16, currency: 16, research: 14, influence: 12 };
  player.labor = stageIndex === 0 ? 3 : stageIndex === 1 ? 6 : 10;
  player.laborCap = Math.max(player.laborCap, player.labor);
  for (const branch of Object.keys(player.tech) as TechnologyBranch[]) player.tech[branch] = exercise.technologyLevel;
  for (const vessel of player.explorationVessels) { vessel.readyTurn = game.turn; vessel.movesRemaining = 1; }
  for (const vessel of player.colonyShips) { vessel.readyTurn = game.turn; vessel.movesRemaining = 1; }
  for (const carrier of game.carriers.filter((candidate) => candidate.owner === 0)) { carrier.readyTurn = game.turn; carrier.movesRemaining = 2; }
  for (const mobile of game.mobileHabitats.filter((candidate) => candidate.owner === 0)) { mobile.readyTurn = game.turn; mobile.movesRemaining = 1; }
  for (const participant of game.players) {
    drawHiddenChoices(game, participant.id, game.era);
    const hidden = participant.hiddenLegacy[game.era];
    if (!hidden.selected && hidden.choices[0]) selectHiddenLegacy(game, participant.id, hidden.choices[0]);
  }

  if (stageIndex > 0) {
    const candidates = game.hexes.filter((hex) => hex.kind !== "home" && hex.kind !== "rift" && hex.owner === undefined).slice(0, stageIndex + 1);
    candidates.forEach((hex, index) => {
      hex.revealed = true;
      hex.owner = 0;
      hex.originalOwner ??= 0;
      hex.tier = stageIndex === 2 && index === 0 ? "Metropolis" : "Colony";
      hex.centers = index === 0 ? ["material", "currency"] : ["research"];
    });
  }

  const faction = player.faction;
  const playerHome = home(game, 0);
  const adjacentExerciseHex = getNeighbors(playerHome.id, mapLibrary[game.mapId]).map((id) => game.hexes.find((hex) => hex.id === id)).find((hex) => hex && hex.kind !== "rift");
  if (adjacentExerciseHex) adjacentExerciseHex.revealed = true;
  if (faction === "spires" && stageIndex === 0) { playerHome.tier = "Outpost"; playerHome.centers = []; player.tech.Resource = 2; }
  if (faction === "spires" && stageIndex === 2) { playerHome.tier = "Metropolis"; playerHome.arcologyOrigin = undefined; playerHome.centers = ["material", "currency", "research"]; player.tech.Resource = 4; }
  if (faction === "foundry" && stageIndex === 1 && adjacentExerciseHex) {
    adjacentExerciseHex.owner = undefined;
    adjacentExerciseHex.tier = undefined;
    adjacentExerciseHex.kind = "material";
    adjacentExerciseHex.prospected = false;
    if (!game.civilianUnits.some((unit) => unit.id === "academy-prospector")) game.civilianUnits.push({ id: "academy-prospector", owner: 0, type: "prospector", hex: adjacentExerciseHex.id, readyTurn: game.turn, movesRemaining: 1 });
  }
  if (faction === "aegis" && stageIndex > 0) {
    if (!playerHome.centers.includes("defense")) playerHome.centers.push("defense");
    playerHome.defenseGridOrigin = "aegis";
    player.tech.Military = Math.max(player.tech.Military, 2);
    if (stageIndex === 2) player.tech.Economy = Math.max(player.tech.Economy, 2);
    if (!game.carriers.some((asset) => asset.owner === 0 && asset.type === "blockadeTender")) game.carriers.push({ id: "academy-blockade-tender", owner: 0, type: "blockadeTender", hex: playerHome.id, cu: 2, readyTurn: game.turn, movesRemaining: 2 });
    if (stageIndex === 2) {
      const buyer = game.players[1];
      buyer.resources.material = Math.max(buyer.resources.material, 5);
      buyer.resources.currency = Math.max(buyer.resources.currency, 5);
      buyer.labor = Math.max(buyer.labor, 5);
      buyer.laborCap = Math.max(buyer.laborCap, buyer.labor);
    }
  }
  if (faction === "aegis" && stageIndex === 0 && adjacentExerciseHex) {
    adjacentExerciseHex.owner = 0;
    adjacentExerciseHex.originalOwner ??= 0;
    adjacentExerciseHex.tier = "Outpost";
    adjacentExerciseHex.centers = [];
  }
  if (faction === "wayfarers") {
    const mobile = game.mobileHabitats.find((asset) => asset.owner === 0);
    if (mobile) { mobile.centers = stageIndex === 0 ? ["material"] : ["material", "currency"]; mobile.caravanGuards = stageIndex === 2 ? 2 : 0; mobile.deployed = true; }
    if (stageIndex === 2 && !game.mobileHabitats.some((asset) => asset.owner === 0 && asset.type === "worldship")) game.mobileHabitats.push({ id: "academy-worldship", owner: 0, type: "worldship", hex: playerHome.id, centers: ["research", "labor"], caravanGuards: 1, readyTurn: game.turn, movesRemaining: 1, deployed: true });
    if (stageIndex === 2 && !game.carriers.some((asset) => asset.owner === 0 && asset.type === "gunneryPlatform")) game.carriers.push({ id: "academy-gunnery", owner: 0, type: "gunneryPlatform", hex: playerHome.id, cu: 2, readyTurn: game.turn, movesRemaining: 2 });
  }
  if (faction === "salvo" && stageIndex === 2 && !game.carriers.some((asset) => asset.owner === 0 && asset.type === "siegeTender")) game.carriers.push({ id: "academy-siege-tender", owner: 0, type: "siegeTender", hex: playerHome.id, cu: 2, readyTurn: game.turn, movesRemaining: 2 });
  if (faction === "salvo" && adjacentExerciseHex) {
    const target = game.carriers.find((asset) => asset.owner === 1)!;
    let targetHex = adjacentExerciseHex;
    if (stageIndex === 2) {
      const neighbors = getNeighbors(playerHome.id, mapLibrary[game.mapId]);
      const coordinatedTarget = game.hexes.find((hex) => hex.kind !== "rift" && hex.id !== playerHome.id && !neighbors.includes(hex.id) && neighbors.some((middle) => getNeighbors(hex.id, mapLibrary[game.mapId]).includes(middle)));
      if (coordinatedTarget) {
        const middleId = neighbors.find((middle) => getNeighbors(coordinatedTarget.id, mapLibrary[game.mapId]).includes(middle))!;
        const middle = game.hexes.find((hex) => hex.id === middleId)!;
        middle.revealed = true;
        middle.owner = 0;
        coordinatedTarget.revealed = true;
        targetHex = coordinatedTarget;
      }
    }
    target.hex = targetHex.id;
    target.cu = Math.max(target.cu, 4);
  }
  if (faction === "guilds") {
    if (playerHome.centers.length < 2) playerHome.centers.push("currency");
    playerHome.enhancedCenterIndices = stageIndex === 0 ? [0] : [0, 1];
    if (stageIndex === 2 && !playerHome.centers.includes("factory")) playerHome.centers.push("factory");
  }
  game.log.unshift(`${factionLibrary[faction].name} Academy exercise loaded: ${exercise.title}.`);
}

export function createFactionAcademy(factionId: FactionId, theme: ThemeId = "horizon-base") {
  if (!academyScenarios[factionId]) throw new Error("That faction does not have an Academy scenario.");
  const rivals = factionIds.filter((id) => id !== factionId).slice(0, 2);
  const game = createGame(3, [factionId, ...rivals], "first-horizon", theme, 31010 + factionIds.indexOf(factionId), [
    { kind: "human" }, { kind: "bot", profileId: "tutorial-guide" }, { kind: "bot", profileId: "tutorial-guide" },
  ], false, "four-era");
  game.scenarioId = "faction-academy";
  game.secretHiddenScoring = false;
  game.academy = { factionId, stage: 0, completedStages: [], completed: false, freePractice: false, dismissed: false, stageStartedTurn: 1, stageEvents: [], startedAt: new Date().toISOString() };
  for (const player of game.players) {
    drawHiddenChoices(game, player.id, 1);
    const choice = player.hiddenLegacy[1]?.choices[0];
    if (choice) selectHiddenLegacy(game, player.id, choice);
  }
  refreshContacts(game);
  prepareAcademyStage(game, 0);
  return game;
}

export function advanceAcademy(game: GameState) {
  const academy = game.academy;
  if (game.scenarioId !== "faction-academy" || !academy) return false;
  const exercise = academyScenarios[academy.factionId]?.stages[academy.stage];
  if (exercise && !academy.completedStages.includes(exercise.id)) academy.completedStages.push(exercise.id);
  if (academy.stage < 2) {
    academy.stage += 1;
    academy.dismissed = false;
    prepareAcademyStage(game, academy.stage);
  } else {
    academy.completed = true;
    academy.freePractice = true;
    academy.completedAt ||= new Date().toISOString();
    academy.dismissed = true;
    game.log.unshift(`${factionLibrary[academy.factionId].name} Academy completed. Free practice is active.`);
  }
  return true;
}

export function restartAcademyStage(game: GameState) {
  if (game.scenarioId !== "faction-academy" || !game.academy) return false;
  game.academy.dismissed = false;
  prepareAcademyStage(game, game.academy.stage);
  return true;
}

function addAcademyEvent(game: GameState, event: string) {
  if (game.scenarioId !== "faction-academy" || !game.academy || game.academy.completed) return false;
  game.academy.stageEvents ||= [];
  if (game.academy.stageEvents.includes(event)) return false;
  game.academy.stageEvents.push(event);
  return true;
}

export function recordAcademyPanel(game: GameState, panel: string) {
  return addAcademyEvent(game, `panel:${panel === "faction" ? "academy" : panel}`);
}

export function recordAcademyCommand(game: GameState, command: { kind: string; orders?: import("./types").SecretOrder[] }) {
  if (game.scenarioId !== "faction-academy" || !game.academy) return false;
  let changed = addAcademyEvent(game, `command:${command.kind}`);
  for (const order of command.orders || []) {
    changed = addAcademyEvent(game, `order:${order.kind}`) || changed;
    if (order.kind === "construct") {
      changed = addAcademyEvent(game, `order:construct:${order.construction.type}`) || changed;
      if (order.construction.type === "center") changed = addAcademyEvent(game, `order:construct:${order.construction.center}`) || changed;
    }
  }
  return changed;
}

export function academyRequirementProgress(game: GameState): AcademyRequirementProgress[] {
  const academy = game.academy;
  if (game.scenarioId !== "faction-academy" || !academy || academy.completed) return [];
  const scenario = academyScenarios[academy.factionId];
  const events = new Set(academy.stageEvents || []);
  const acceptedEvents = exerciseEvents[academy.factionId]?.[academy.stage] || signatureEvents[academy.factionId] || [];
  const actionComplete = acceptedEvents.some((event) => events.has(event));
  const actionIsOrder = acceptedEvents.some((event) => event.startsWith("order:") && events.has(event));
  const resolved = !actionIsOrder || game.turn > (academy.stageStartedTurn || 0) || Boolean(game.result);
  if (academy.stage === 0) {
    const expected = scenario.stages[0].panel === "faction" ? "academy" : scenario.stages[0].panel;
    const panel = { id: "open", label: acceptedEvents.length ? `Open the ${expected} panel and inspect the prepared position` : scenario.stages[0].completion, complete: events.has(`panel:${expected}`) };
    return acceptedEvents.length ? [panel, { id: "ability", label: scenario.stages[0].completion, complete: actionComplete && resolved }] : [panel];
  }
  const action = { id: "ability", label: scenario.stages[academy.stage].completion, complete: actionComplete && resolved };
  if (academy.stage === 1) return [action];
  return [
    { id: "legacy", label: "Open Legacy and review exact faction objective progress", complete: events.has("panel:legacy") },
    action,
  ];
}

export function syncAcademy(game: GameState) {
  const requirements = academyRequirementProgress(game);
  if (!requirements.length || requirements.some((requirement) => !requirement.complete)) return false;
  return advanceAcademy(game);
}
