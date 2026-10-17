import { botChallengeOptions, getBotProfile } from "../bots";
import { createGame, resolveSecretOrders, takeBotTurn } from "../game/index";
import type { FactionId, PlayerController } from "../game/index";
const factions: FactionId[] = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian", "spires", "aegis", "wayfarers", "salvo", "guilds"];
const rounds = Math.max(1, Math.min(44, Number(process.argv[2] || 11)));
const firstRun = Math.max(0, Math.floor(Number(process.argv[3] || 0)));
const out = Object.fromEntries(botChallengeOptions.map(({ id }) => [id, { games: 0, lp: 0, wins: 0, gateSurvived: 0, tributes: 0, claims: 0, hidden: 0, failures: 0, samples: [] as Array<{ seed: number; faction: FactionId; lp: number; tributes: number; win: boolean; gateSurvived: boolean }> }])) as Record<string, { games: number; lp: number; wins: number; gateSurvived: number; tributes: number; claims: number; hidden: number; failures: number; samples: Array<{ seed: number; faction: FactionId; lp: number; tributes: number; win: boolean; gateSurvived: boolean }> }>;
for (let index = 0; index < rounds; index++) for (const option of botChallengeOptions) {
  const run = firstRun + index;
  const selected = Array.from({ length: 4 }, (_, seat) => factions[(run + seat * 3) % factions.length]);
  const controllers: PlayerController[] = selected.map((_, seat) => ({ kind: "bot", profileId: seat === 0 ? option.id : "ai-medium" }));
  const game = createGame(4, selected, "shattered-reach", "horizon-base", 34500 + run, controllers, true);
  let guard = 0;
  while (!game.result && guard++ < 100) {
    if (game.orderProtocol.phase === "orders") {
      const id = game.orderProtocol.currentPlayer, controller = game.players[id].controller;
      if (controller.kind !== "bot") throw new Error("Human seat in AI test");
      const result = takeBotTurn(game, id, getBotProfile(controller.profileId)!);
      if (!result.ok || !("report" in result)) throw new Error(result.message);
      if (id === 0 && !result.report.submissionOk) out[option.id].failures++;
    } else if (game.orderProtocol.phase === "ready") {
      const result = resolveSecretOrders(game);
      if (!result.ok) throw new Error(result.message);
    } else throw new Error(`Unexpected phase ${game.orderProtocol.phase}`);
  }
  if (!game.result) throw new Error("Campaign incomplete");
  const stat = out[option.id], player = game.players[0];
  stat.games++; stat.lp += player.lp; stat.wins += Number(game.result.winnerIds.includes(0));
  stat.gateSurvived += Number(game.result.gateSucceeded); stat.tributes += player.tributes;
  stat.claims += player.civilizationClaims.length + game.universalClaims.filter((claim) => claim.playerId === 0).length;
  stat.hidden += Object.values(player.hiddenLegacy).filter((state) => state.completed).length;
  stat.samples.push({ seed: 34500 + run, faction: selected[0], lp: player.lp, tributes: player.tributes, win: game.result.winnerIds.includes(0), gateSurvived: game.result.gateSucceeded });
}
console.log(JSON.stringify({ firstSeed: 34500 + firstRun, lastSeed: 34500 + firstRun + rounds - 1, results: Object.fromEntries(Object.entries(out).map(([id, s]) => [id, {
  games: s.games, wins: s.wins, gateSurvival: s.gateSurvived / s.games, averageTributes: +(s.tributes / s.games).toFixed(2),
  averageLP: +(s.lp / s.games).toFixed(2), averageClaims: +(s.claims / s.games).toFixed(2),
  averageHidden: +(s.hidden / s.games).toFixed(2), failedSubmissions: s.failures,
  medianLP: [...s.samples].sort((a, b) => a.lp - b.lp)[Math.floor(s.samples.length / 2)].lp,
  rangeLP: [Math.min(...s.samples.map((sample) => sample.lp)), Math.max(...s.samples.map((sample) => sample.lp))],
  samples: s.samples,
}])) }, null, 2));
