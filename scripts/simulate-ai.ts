import { getBotProfile } from "../bots";
import {
  createGame,
  resolveSecretOrders,
  takeBotTurn,
  mapLibrary,
  type FactionId,
  type PlayerController,
} from "../game/index";

const profile = getBotProfile(process.argv[3] || "meta-analyst");
if (!profile) throw new Error("Choose an installed bot profile ID.");
const mapId = process.argv[4] || "shattered-reach";
if (!mapLibrary[mapId]) throw new Error("Choose an installed map ID.");
const playerCount = Number(process.argv[5] || 6);
if (![4, 5, 6].includes(playerCount)) throw new Error("Choose 4, 5, or 6 players.");
const requested = Number(process.argv[2] || 100);
const games = Number.isFinite(requested) ? Math.max(1, Math.min(10000, Math.floor(requested))) : 100;
const factions: FactionId[] = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian"];
const wins = Object.fromEntries(factions.map((faction) => [faction, 0])) as Record<FactionId, number>;
const tributeTotals = Object.fromEntries(factions.map((faction) => [faction, 0])) as Record<FactionId, number>;
const lpTotals = Object.fromEntries(factions.map((faction) => [faction, 0])) as Record<FactionId, number>;
let gateSuccesses = 0, totalGate = 0, totalLP = 0, totalOrders = 0, totalCandidates = 0, totalNodes = 0;
let totalResources = 0, totalHabitats = 0, totalTrades = 0, totalTechnology = 0, totalMilitary = 0, totalContributionVariance = 0;
let hiddenSelected = 0, hiddenCompleted = 0, civilizationClaims = 0, universalClaims = 0, contributingEras = 0, eligibleEras = 0;
let counteroffers = 0, failedSubmissions = 0, totalExpectedLP = 0, decisions = 0;
const hiddenByObjective: Record<string, { selected: number; completed: number }> = {};
const civilizationClaimsByObjective: Record<string, number> = {};
const hiddenOrderKinds: Record<string, Record<string, number>> = {};
const started = performance.now();

for (let run = 0; run < games; run++) {
  const chosen = Array.from({ length: playerCount }, (_, seat) => factions[(run + seat) % factions.length]);
  const bots: PlayerController[] = chosen.map(() => ({ kind: "bot", profileId: profile.id }));
  const game = createGame(playerCount, chosen, mapId, "horizon-base", 21000 + run, bots, true);
  let guard = 0;
  while (!game.result && guard++ < 128) {
    if (game.orderProtocol.phase === "orders") {
      const action = takeBotTurn(game, game.orderProtocol.currentPlayer, profile);
      if (!action.ok) throw new Error(`Seed ${21000 + run}: ${action.message}`);
      if (!("orders" in action)) throw new Error(`Seed ${21000 + run}: bot action did not return Orders`);
      totalOrders += action.orders.length;
      decisions++;
      totalCandidates += action.report.candidateCount;
      totalNodes += action.report.planningNodes;
      if (!action.report.submissionOk) failedSubmissions++;
      totalExpectedLP += action.report.goalAnalysis.length;
      if (action.report.hiddenObjectiveId) {
        const kinds = hiddenOrderKinds[action.report.hiddenObjectiveId] ||= {};
        for (const order of action.orders) kinds[order.kind] = (kinds[order.kind] || 0) + 1;
      }
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
  for (const player of game.players) {
    tributeTotals[player.faction] += player.tributes;
    lpTotals[player.faction] += player.lp;
    civilizationClaims += player.civilizationClaims.length;
    for (const era of Array.from({ length: 4 }, (_, index) => index + 1)) {
      const hidden = player.hiddenLegacy[era];
      if (hidden?.selected) {
        hiddenSelected++;
        hiddenByObjective[hidden.selected] ||= { selected: 0, completed: 0 };
        hiddenByObjective[hidden.selected].selected++;
        if (hidden.completed) hiddenByObjective[hidden.selected].completed++;
      }
      if (hidden?.completed) hiddenCompleted++;
      eligibleEras++;
      if (player.eraTributes[era - 1] > 0) contributingEras++;
    }
  }
  universalClaims += game.universalClaims.length;
  for (const player of game.players) for (const objectiveId of player.civilizationClaims)
    civilizationClaimsByObjective[objectiveId] = (civilizationClaimsByObjective[objectiveId] || 0) + 1;
  counteroffers += game.proposals.filter((proposal) => proposal.kind === "trade" && !!proposal.counterOf).length;
  for (const winner of game.result.winnerIds) wins[game.players[winner].faction]++;
}

const elapsed = performance.now() - started;
console.log(JSON.stringify({
  profile: profile.name,
  mapId,
  playerCount,
  games,
  gateSuccessRate: gateSuccesses / games,
  averageGateTributes: totalGate / games,
  averageLPPerCivilization: totalLP / games / playerCount,
  averageFinalResourcesPerCivilization: totalResources / games / playerCount,
  averageHabitatsPerCivilization: totalHabitats / games / playerCount,
  averageAcceptedTradesPerGame: totalTrades / games,
  averageTechnologyTotalPerCivilization: totalTechnology / games / playerCount,
  averageMilitaryCSPerCivilization: totalMilitary / games / playerCount,
  contributionStandardDeviation: Math.sqrt(totalContributionVariance / games),
  hiddenObjectiveCompletionRate: hiddenCompleted / Math.max(1, hiddenSelected),
  civilizationClaimsPerCivilization: civilizationClaims / games / playerCount,
  universalClaimsPerCivilization: universalClaims / games / playerCount,
  contributionEraRate: contributingEras / Math.max(1, eligibleEras),
  averageCounteroffersPerGame: counteroffers / games,
  failedSubmissionRate: failedSubmissions / Math.max(1, decisions),
  averageGoalsTrackedPerDecision: totalExpectedLP / Math.max(1, decisions),
  averageOrdersPerTurn: totalOrders / Math.max(1, decisions),
  averageCandidatesPerRecordedDecision: totalCandidates / Math.max(1, decisions),
  averageSearchNodesPerRecordedDecision: totalNodes / Math.max(1, decisions),
  averageTributesByFaction: Object.fromEntries(factions.map((faction) => [faction, tributeTotals[faction] / games])),
  averageLPByFaction: Object.fromEntries(factions.map((faction) => [faction, lpTotals[faction] / games])),
  hiddenByObjective,
  hiddenOrderKinds,
  civilizationClaimsByObjective,
  wins,
  elapsedMs: Math.round(elapsed),
  gamesPerSecond: Math.round(games / (elapsed / 1000) * 10) / 10,
}, null, 2));
