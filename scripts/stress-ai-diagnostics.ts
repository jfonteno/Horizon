import { getBotProfile } from "../bots";
import { createGame, resolveSecretOrders, takeBotTurn } from "../game/index";
import type { FactionId, PlayerController } from "../game/index";
import { gateTarget } from "../game/rules/format";
import { productionPerTurn } from "../game/ai/strategy";

const factions: FactionId[] = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian", "spires", "aegis", "wayfarers", "salvo", "guilds"];
const rounds = Math.max(1, Math.min(100, Number(process.argv[2] || 33)));
const profileId = process.argv[3] || "ai-emperor";
const seats = Math.max(4, Math.min(6, Number(process.argv[4] || 6)));
const firstSeed = Number(process.argv[5] || 39000);
const profile = getBotProfile(profileId);
if (!profile) throw new Error(`Unknown profile ${profileId}`);
const results = [];
for (let run = 0; run < rounds; run++) {
  const selected = Array.from({ length: seats }, (_, seat) => factions[(run + seat * 3) % factions.length]);
  const controllers: PlayerController[] = selected.map(() => ({ kind: "bot", profileId }));
  const game = createGame(seats, selected, "shattered-reach", "horizon-base", firstSeed + run, controllers, true);
  const eraGate: number[] = [];
  let failedSubmissions = 0;
  let guard = 0;
  while (!game.result && guard++ < 130) {
    if (game.orderProtocol.phase === "orders") {
      const action = takeBotTurn(game, game.orderProtocol.currentPlayer, profile);
      if (!action.ok || !("report" in action)) throw new Error(`Seed ${firstSeed + run}: ${action.message}`);
      if (!action.report.submissionOk) failedSubmissions++;
    } else if (game.orderProtocol.phase === "ready") {
      const turn = game.turn;
      const action = resolveSecretOrders(game);
      if (!action.ok) throw new Error(`Seed ${firstSeed + run}: ${action.message}`);
      if (turn % 4 === 0) eraGate.push(game.gate);
    } else throw new Error(`Unexpected phase ${game.orderProtocol.phase}`);
  }
  if (!game.result) throw new Error(`Seed ${firstSeed + run}: incomplete`);
  results.push({
    seed: firstSeed + run, gate: game.gate, target: gateTarget(game), gateSucceeded: game.result.gateSucceeded, eraGate,
    failedSubmissions,
    players: game.players.map((player) => ({
      faction: player.faction, lp: player.lp, wins: game.result!.winnerIds.includes(player.id),
      tributes: player.tributes, eraTributes: player.eraTributes,
      habitats: game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length,
      centers: game.hexes.filter((hex) => hex.owner === player.id).flatMap((hex) => hex.centers),
      mobileHabitats: game.mobileHabitats.filter((mobile) => mobile.owner === player.id).length,
      resources: player.resources, production: productionPerTurn(game, player.id),
      tech: player.tech, civilizationClaims: player.civilizationClaims,
      hiddenSelected: Object.values(player.hiddenLegacy).map((item) => item.selected).filter(Boolean),
      hiddenCompleted: Object.values(player.hiddenLegacy).filter((item) => item.completed).length,
      agreements: game.agreements.filter((agreement) => agreement.parties.includes(player.id)).length,
      acceptedTrades: game.proposals.filter((proposal) => proposal.kind === "trade" && proposal.status === "accepted" &&
        (proposal.from === player.id || proposal.to === player.id)).length,
      blockadeCommissions: game.proposals.filter((proposal) => proposal.kind === "trade" && proposal.blockadeCommission &&
        proposal.status === "accepted" && proposal.from === player.id).length,
    })),
  });
}
console.log(JSON.stringify({ profileId, seats, rounds, firstSeed, results }, null, 2));
