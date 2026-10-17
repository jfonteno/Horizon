import { getBotProfile } from "../bots";
import { createGame, resolveSecretOrders, takeBotTurn } from "../game/index";
import type { FactionId, PlayerController } from "../game/index";
import { productionPerTurn } from "../game/ai/strategy";

const factions: FactionId[] = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian", "spires", "aegis", "wayfarers", "salvo", "guilds"];
const run = Number(process.argv[2] || 210), profileId = process.argv[3] || "ai-emperor";
const selected = Array.from({ length: 4 }, (_, seat) => factions[(run + seat * 3) % factions.length]);
const controllers: PlayerController[] = selected.map((_, seat) => ({ kind: "bot", profileId: seat === 0 ? profileId : "ai-medium" }));
const game = createGame(4, selected, "shattered-reach", "horizon-base", 34500 + run, controllers, true);
const turns = [];
let guard = 0;
while (!game.result && guard++ < 120) {
  if (game.orderProtocol.phase === "orders") {
    const seat = game.orderProtocol.currentPlayer;
    const controller = game.players[seat].controller;
    if (controller.kind !== "bot") throw new Error("Human seat in AI trace");
    const result = takeBotTurn(game, seat, getBotProfile(controller.profileId)!);
    if (!result.ok || !("report" in result)) throw new Error(result.message);
    if (seat === 0) turns.push({ turn: game.turn, gate: game.gate,
      resources: { ...game.players[0].resources }, income: productionPerTurn(game, 0),
      tech: { ...game.players[0].tech },
      projects: result.report.strategicForecast.filter((line) => line.startsWith("Project ")),
      orders: result.orders.map((order) => order.kind === "construct" ?
        `${order.kind}:${order.construction.type}:${"center" in order.construction ? order.construction.center : ""}` :
        order.kind === "technology" ? `technology:${order.branch}` : order.kind),
      diplomacy: result.report.diplomacy });
  } else if (game.orderProtocol.phase === "ready") {
    const result = resolveSecretOrders(game);
    if (!result.ok) throw new Error(result.message);
  } else throw new Error(`Unexpected phase ${game.orderProtocol.phase}`);
}
console.log(JSON.stringify({ run, selected, gate: game.gate, result: game.result, turns,
  players: game.players.map((player) => ({ faction: player.faction, lp: player.lp, resources: player.resources,
    tributes: player.tributes, claims: player.civilizationClaims })) }, null, 2));
