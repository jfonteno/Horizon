import profileJson from "../bots/profiles/meta-analyst.json" with { type: "json" };
import {
  createGame,
  resolveSecretOrders,
  takeBotTurn,
  type BotProfile,
  type FactionId,
  type PlayerController,
} from "../game/index";

const profile = profileJson as BotProfile;
const requested = Number(process.argv[2] || 100);
const games = Number.isFinite(requested) ? Math.max(1, Math.min(10000, Math.floor(requested))) : 100;
const factions: FactionId[] = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian"];
const wins = Object.fromEntries(factions.map((faction) => [faction, 0])) as Record<FactionId, number>;
const tributeTotals = Object.fromEntries(factions.map((faction) => [faction, 0])) as Record<FactionId, number>;
let gateSuccesses = 0, totalGate = 0, totalLP = 0, totalOrders = 0, totalCandidates = 0, totalNodes = 0;
let totalResources = 0, totalHabitats = 0, totalTrades = 0, totalTechnology = 0, totalMilitary = 0, totalContributionVariance = 0;
const started = performance.now();

for (let run = 0; run < games; run++) {
  const chosen = Array.from({ length: 6 }, (_, seat) => factions[(run + seat) % factions.length]);
  const bots: PlayerController[] = chosen.map(() => ({ kind: "bot", profileId: profile.id }));
  const game = createGame(6, chosen, "shattered-reach", "horizon-base", 21000 + run, bots, true);
  let guard = 0;
  while (!game.result && guard++ < 128) {
    if (game.orderProtocol.phase === "orders") {
      const action = takeBotTurn(game, game.orderProtocol.currentPlayer, profile);
      if (!action.ok) throw new Error(`Seed ${21000 + run}: ${action.message}`);
      if (!("orders" in action)) throw new Error(`Seed ${21000 + run}: bot action did not return Orders`);
      totalOrders += action.orders.length;
    } else if (game.orderProtocol.phase === "ready") {
      const resolution = resolveSecretOrders(game);
      if (!resolution.ok) throw new Error(`Seed ${21000 + run}: ${resolution.message}`);
    } else throw new Error(`Seed ${21000 + run}: unexpected phase ${game.orderProtocol.phase}`);
  }
  if (!game.result) throw new Error(`Seed ${21000 + run}: simulation guard exhausted`);
  if (game.result.gateSucceeded) gateSuccesses++;
  totalGate += game.gate;
  totalLP += game.players.reduce((sum, player) => sum + player.lp, 0);
  totalResources += game.players.reduce((sum, player) => sum + Object.values(player.resources).reduce((resourceSum, amount) => resourceSum + amount, 0), 0);
  totalHabitats += game.players.reduce((sum, player) => sum + game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length, 0);
  totalTrades += game.proposals.filter((proposal) => proposal.kind === "trade" && proposal.status === "accepted").length;
  totalTechnology += game.players.reduce((sum, player) => sum + Object.values(player.tech).reduce((techSum, level) => techSum + level, 0), 0);
  totalMilitary += game.players.reduce((sum, player) => sum + game.carriers.filter((carrier) => carrier.owner === player.id).reduce((cs, carrier) => cs + carrier.cu, 0) + game.hexes.filter((hex) => hex.owner === player.id).reduce((cs, hex) => cs + hex.combat, 0), 0);
  const meanContribution = game.players.reduce((sum, player) => sum + player.tributes, 0) / game.players.length;
  totalContributionVariance += game.players.reduce((sum, player) => sum + (player.tributes - meanContribution) ** 2, 0) / game.players.length;
  for (const player of game.players) tributeTotals[player.faction] += player.tributes;
  for (const winner of game.result.winnerIds) wins[game.players[winner].faction]++;
  for (const report of game.botReports) {
    totalCandidates += report.candidateCount;
    totalNodes += report.planningNodes;
  }
}

const elapsed = performance.now() - started;
console.log(JSON.stringify({
  profile: profile.name,
  games,
  gateSuccessRate: gateSuccesses / games,
  averageGateTributes: totalGate / games,
  averageLPPerCivilization: totalLP / games / 6,
  averageFinalResourcesPerCivilization: totalResources / games / 6,
  averageHabitatsPerCivilization: totalHabitats / games / 6,
  averageAcceptedTradesPerGame: totalTrades / games,
  averageTechnologyTotalPerCivilization: totalTechnology / games / 6,
  averageMilitaryCSPerCivilization: totalMilitary / games / 6,
  contributionStandardDeviation: Math.sqrt(totalContributionVariance / games),
  averageOrdersPerTurn: totalOrders / games / 96,
  averageCandidatesPerRecordedDecision: totalCandidates / games / 48,
  averageSearchNodesPerRecordedDecision: totalNodes / games / 48,
  averageTributesByFaction: Object.fromEntries(factions.map((faction) => [faction, tributeTotals[faction] / games])),
  wins,
  elapsedMs: Math.round(elapsed),
  gamesPerSecond: Math.round(games / (elapsed / 1000) * 10) / 10,
}, null, 2));
