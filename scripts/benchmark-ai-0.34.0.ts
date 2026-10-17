import { botChallengeOptions, getBotProfile } from "../bots";
import { createGame, resolveSecretOrders, takeBotTurn } from "../game/index";
import type { FactionId, PlayerController } from "../game/index";

const factions: FactionId[] = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian", "spires", "aegis", "wayfarers", "salvo", "guilds"];
const rounds = Math.max(1, Math.min(44, Number(process.argv[2] || 11)));
const firstRun = Math.max(0, Math.floor(Number(process.argv[3] || 0)));
const stats = Object.fromEntries(botChallengeOptions.map(({ id }) => [id, { matches: 0, wins: 0, lp: 0, habitats: 0, tributes: 0, hidden: 0, claims: 0, submitted: 0, failures: 0 }])) as Record<string, { matches: number; wins: number; lp: number; habitats: number; tributes: number; hidden: number; claims: number; submitted: number; failures: number }>;
const factionStats = Object.fromEntries(factions.map((id) => [id, { matches: 0, lp: 0, tributes: 0, wins: 0 }])) as Record<string, { matches: number; lp: number; tributes: number; wins: number }>;
for (let index = 0; index < rounds; index++) {
  const run = firstRun + index;
  const selected = Array.from({ length: 4 }, (_, seat) => factions[(run * 3 + seat) % factions.length]);
  const assigned = Array.from({ length: 4 }, (_, seat) => botChallengeOptions[(seat + run) % 4].id);
  const controllers: PlayerController[] = assigned.map((profileId) => ({ kind: "bot", profileId }));
  const game = createGame(4, selected, "shattered-reach", "horizon-base", 34000 + run, controllers, true);
  let guard = 0;
  while (!game.result && guard++ < 110) {
    if (game.orderProtocol.phase === "orders") {
      const id = game.orderProtocol.currentPlayer, profileId = assigned[id];
      const action = takeBotTurn(game, id, getBotProfile(profileId)!);
      if (!action.ok || !("report" in action)) throw new Error(`Round ${run}, ${profileId}: ${action.message}`);
      stats[profileId].submitted++;
      if (!action.report.submissionOk) stats[profileId].failures++;
    } else if (game.orderProtocol.phase === "ready") {
      const action = resolveSecretOrders(game);
      if (!action.ok) throw new Error(`Round ${run}: ${action.message}`);
    } else throw new Error(`Round ${run}: unexpected phase ${game.orderProtocol.phase}`);
  }
  if (!game.result) throw new Error(`Round ${run}: incomplete campaign`);
  for (const player of game.players) {
    const stat = stats[assigned[player.id]];
    const factionStat = factionStats[player.faction];
    factionStat.matches++;
    factionStat.lp += player.lp;
    factionStat.tributes += player.tributes;
    factionStat.wins += Number(game.result.winnerIds.includes(player.id));
    stat.matches++;
    stat.wins += Number(game.result.winnerIds.includes(player.id));
    stat.lp += player.lp;
    stat.habitats += game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length;
    stat.tributes += player.tributes;
    stat.hidden += Object.values(player.hiddenLegacy).filter((entry) => entry.completed).length;
    stat.claims += player.civilizationClaims.length + game.universalClaims.filter((claim) => claim.playerId === player.id).length;
  }
}
console.log(JSON.stringify({ profiles: Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, {
  games: s.matches, wins: s.wins, averageLP: +(s.lp / s.matches).toFixed(2), averageHabitats: +(s.habitats / s.matches).toFixed(2),
  averageTributes: +(s.tributes / s.matches).toFixed(2), hiddenCompleted: s.hidden, claims: s.claims,
  failedSubmissionRate: s.failures / s.submitted,
}])), factions: Object.fromEntries(Object.entries(factionStats).map(([id, s]) => [id, {
  games: s.matches, averageLP: s.matches ? +(s.lp / s.matches).toFixed(2) : 0,
  averageTributes: s.matches ? +(s.tributes / s.matches).toFixed(2) : 0, wins: s.wins,
}])) }, null, 2));
