import { createGame } from "./engine/create-game";
import { refreshContacts } from "./rules/diplomacy";
import { drawHiddenChoices } from "./rules/legacy";
import type { GameState } from "./types";
import type { ThemeId } from "./themes";

export type TutorialLesson = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  objective: string;
  panel?: string;
  codex?: string;
};

export const firstHorizonLessons: TutorialLesson[] = [
  {
    id: "welcome", eyebrow: "FIRST HORIZON", title: "Your first command",
    body: "You lead the Foundry in a compact teaching system. This is a real Horizon match using the normal rules, with guidance added as you play.",
    objective: "Continue when you are ready to choose your first private objective.", codex: "getting-started",
  },
  {
    id: "legacy", eyebrow: "LESSON 1 · LEGACY", title: "Choose your private ambition",
    body: "Legacy Points determine the winner if the Horizon Gate succeeds. At the start of each Era, choose one Hidden Objective that fits your plan.",
    objective: "Open Legacy and select an Era I Hidden Objective.", panel: "legacy", codex: "legacy-gate",
  },
  {
    id: "inspect", eyebrow: "LESSON 2 · THE SYSTEM", title: "Read the board",
    body: "Every hex is a sector. Revealed worlds show their production; dark sectors remain uncharted. Your Foundry starts beside a Currency world at 2-1. Select a sector away from your Homeworld to inspect it.",
    objective: "Select any non-Homeworld sector.", panel: "map", codex: "map-exploration",
  },
  {
    id: "explore", eyebrow: "LESSON 3 · ORDERS", title: "Reveal the frontier",
    body: "Select your Exploration Vessel on the map, tap Move, then select the highlighted 2-1 Currency world or another adjacent uncharted sector. Seal Orders to reveal it. You can inspect the Resources forecast in Economy afterward.",
    objective: "Reveal at least one new sector and advance to Turn 2.", panel: "orders", codex: "orders",
  },
  {
    id: "settle", eyebrow: "LESSON 4 · EXPANSION", title: "Establish an Outpost",
    body: "Move a Colony Ship onto a revealed resource world. On a later Order, use Establish to spend a Habitat Module and claim it as an Outpost. Colony Ships are immune to ordinary combat, and you can build more in Construction, but your completed Habitats still need defense.",
    objective: "Control a second Habitat.", panel: "orders", codex: "habitats",
  },
  {
    id: "develop", eyebrow: "LESSON 5 · DEVELOPMENT", title: "Turn territory into capacity",
    body: "Habitats support Centers, upgrades, vessels, and Combat Units. Material and Currency pay for development while Labor limits how much you can complete each Turn.",
    objective: "Build a Center, upgrade a Habitat, or advance Technology.", panel: "build", codex: "resources-labor",
  },
  {
    id: "gate", eyebrow: "LESSON 6 · SHARED SURVIVAL", title: "Contribute to the Horizon Gate",
    body: "The civilizations compete for Legacy, but everyone loses if the Gate remains incomplete. Tribute costs rise by Era, so early participation preserves flexibility.",
    objective: "Add and resolve your first Gate Tribute.", panel: "gate", codex: "legacy-gate",
  },
  {
    id: "diplomacy", eyebrow: "LESSON 7 · NEGOTIATION", title: "Make another civilization useful",
    body: "Trade can repair shortages before Orders are sealed. Agreements can extend range, protect borders, reduce research costs, and create military coalitions.",
    objective: "Complete a trade or establish an agreement with the Helix.", panel: "diplomacy", codex: "diplomacy",
  },
  {
    id: "combat", eyebrow: "LESSON 8 · DETERRENCE", title: "Command a task force",
    body: "Combat is deterministic. Compare Combat Strength before committing. Equal forces destroy one another; the stronger force survives after losing strength equal to its opponent.",
    objective: "Recruit CU, move a carrier, or initiate combat.", panel: "command", codex: "combat",
  },
  {
    id: "independent", eyebrow: "FINAL EXERCISE", title: "Command without a script",
    body: "You now have the tools to explore, develop, negotiate, and defend yourself. Finish the final Turns while watching the Gate and your Legacy objectives.",
    objective: "Reach the final Turn and complete the Gate.", panel: "orders", codex: "turn-structure",
  },
  {
    id: "complete", eyebrow: "FIRST HORIZON COMPLETE", title: "Your command begins",
    body: "You have completed a real Horizon scenario. Quick Start is the next step: a full four-Era game with a random faction, compatible map, and three to five AI civilizations.",
    objective: "Return to the command interface or review the Horizon Codex.", codex: "getting-started",
  },
];

function totalMetric(game: GameState, key: "builtCenters" | "upgradedHabitats" | "recruitedCU" | "combatInitiated" | "tradeCount") {
  return game.players[0].legacyMetrics[key].reduce((sum, value) => sum + value, 0);
}

export function tutorialStepSatisfied(game: GameState, step = game.tutorial?.step || 0) {
  const player = game.players[0];
  switch (firstHorizonLessons[step]?.id) {
    case "inspect": return game.selected !== game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === 0)?.id;
    case "legacy": return Boolean(player.hiddenLegacy[game.era]?.selected || player.hiddenLegacy[1]?.selected);
    case "explore": return game.turn >= 2 && player.legacyMetrics.revealedHexes[0] > 0;
    case "settle": return game.hexes.filter((hex) => hex.owner === 0 && hex.tier).length >= 2;
    case "develop": return totalMetric(game, "builtCenters") + totalMetric(game, "upgradedHabitats") + player.legacyMetrics.technologyAdvances.flat().length > 0;
    case "gate": return player.tributes > 0;
    case "diplomacy": return totalMetric(game, "tradeCount") > 0 || game.agreements.some((agreement) => agreement.parties.includes(0));
    case "combat": return totalMetric(game, "recruitedCU") > 0 || totalMetric(game, "combatInitiated") > 0;
    case "independent": return Boolean(game.result);
    default: return false;
  }
}

export function advanceTutorial(game: GameState, manual = false) {
  if (!game.tutorial || game.tutorial.dismissed || game.tutorial.completed) return false;
  const current = game.tutorial.step;
  if (!manual && !tutorialStepSatisfied(game, current)) return false;
  game.tutorial.step = Math.min(firstHorizonLessons.length - 1, current + 1);
  if (game.result || game.tutorial.step === firstHorizonLessons.length - 1) {
    game.tutorial.completed = true;
    game.tutorial.completedAt ||= new Date().toISOString();
  }
  return game.tutorial.step !== current;
}

export function syncTutorial(game: GameState) {
  return advanceTutorial(game, false);
}

export function createFirstHorizon(theme: ThemeId = "horizon-base") {
  const game = createGame(
    3,
    ["foundry", "helix", "varkesh"],
    "first-horizon",
    theme,
    25001,
    [
      { kind: "human" },
      { kind: "bot", profileId: "tutorial-guide" },
      { kind: "bot", profileId: "tutorial-guide" },
    ],
    false,
    "first-horizon",
  );
  game.scenarioId = "first-horizon";
  game.secretHiddenScoring = false;
  game.tutorial = {
    id: "first-horizon",
    step: 0,
    completed: false,
    dismissed: false,
    startedAt: new Date().toISOString(),
    seenPanels: [],
  };
  drawHiddenChoices(game, 0, 1);
  for (const player of game.players) {
    player.resources.material = Math.max(player.resources.material, 3);
    player.resources.currency = Math.max(player.resources.currency, 3);
    player.resources.research = Math.max(player.resources.research, 2);
    player.resources.influence = Math.max(player.resources.influence, 2);
  }
  refreshContacts(game);
  game.log.unshift("First Horizon initialized. Guidance is active for the Foundry commander.");
  return game;
}
