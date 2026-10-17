import assert from "node:assert/strict";
import {
  academyScenarios,
  constructionQuote,
  createFactionAcademy,
  factionLibrary,
  legacyObjectiveProgress,
} from "../game/index";

const factions = ["spires", "aegis", "wayfarers", "salvo", "guilds"];
const report: Array<{ faction: string; objectives: number; stages: number; openingValue: number }> = [];

for (const faction of factions) {
  const game = createFactionAcademy(faction);
  const player = game.players[0];
  const home = game.hexes.find((hex) => hex.owner === 0 && hex.tier)!;
  const openingValue = Object.values(player.resources).reduce((sum, value) => sum + value, 0) + player.labor + game.carriers.filter((unit) => unit.owner === 0).length * 2;
  assert.ok(openingValue >= 18 && openingValue <= 30, `${faction} opening package falls outside the Academy test band.`);
  assert.equal(academyScenarios[faction].stages.length, 3);
  assert.equal(factionLibrary[faction].objectives.length, 5);
  for (const objective of ["sp-urban", "ae-fortress", "wa-caravan", "sa-mission", "gu-specialized"].filter((id) => id.startsWith(faction === "spires" ? "sp" : faction === "aegis" ? "ae" : faction === "wayfarers" ? "wa" : faction === "salvo" ? "sa" : "gu"))) {
    const progress = legacyObjectiveProgress(game, 0, objective);
    assert.ok(progress.label.length > 4 && !progress.label.includes("Tracked automatically"));
  }
  const quote = constructionQuote(game, 0, home.id, { type: "upgrade" });
  assert.ok(quote.label.length > 0);
  assert.ok(Object.values(quote.cost).every((value) => value === undefined || value >= 0));
  report.push({ faction, objectives: factionLibrary[faction].objectives.length, stages: academyScenarios[faction].stages.length, openingValue });
}

console.log(JSON.stringify({ validated: factions.length, report }, null, 2));
