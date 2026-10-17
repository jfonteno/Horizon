import { getBotProfile } from "../bots";
import { createGame, resolveSecretOrders, takeBotTurn } from "../game/index";
import type { FactionId, PlayerController } from "../game/index";
import { productionPerTurn } from "../game/ai/strategy";

const factions: FactionId[] = ["varkesh", "helix", "foundry", "farbound", "aurelians", "meridian", "spires", "aegis", "wayfarers", "salvo", "guilds"];
const seed = Number(process.argv[2] || 39107), seats = Number(process.argv[3] || 4), profileId = process.argv[4] || "ai-emperor";
const selected = Array.from({ length: seats }, (_, seat) => factions[(seed - 39100 + seat * 3) % factions.length]);
const controllers: PlayerController[] = selected.map(() => ({ kind: "bot", profileId }));
const game = createGame(seats, selected, "shattered-reach", "horizon-base", seed, controllers, true);
const profile = getBotProfile(profileId)!;
const turns = [];
let guard = 0;
while (!game.result && guard++ < 130) {
  if (game.orderProtocol.phase === "orders") {
    const id = game.orderProtocol.currentPlayer;
    const result = takeBotTurn(game, id, profile);
    if (!result.ok || !("report" in result)) throw new Error(result.message);
    turns.push({ turn: game.turn, seat: id, faction: game.players[id].faction, gate: game.gate,
      vessels: game.carriers.filter((carrier) => carrier.owner === id).map((carrier) => ({ type: carrier.type, hex: carrier.hex, cu: carrier.cu })),
      resources: { ...game.players[id].resources }, income: productionPerTurn(game, id),
      objectives: result.report.goalAnalysis, orders: result.orders.map((order) => order.kind === "construct" ?
        `${order.kind}:${order.construction.type}:${"center" in order.construction ? order.construction.center : ""}` : order.kind),
      diplomacy: result.report.diplomacy });
  } else if (game.orderProtocol.phase === "ready") {
    const result = resolveSecretOrders(game);
    if (!result.ok) throw new Error(result.message);
  } else throw new Error(`Unexpected phase ${game.orderProtocol.phase}`);
}
console.log(JSON.stringify({ seed, selected, gate: game.gate, result: game.result, turns,
  carriers: game.carriers.map((carrier) => ({ owner: carrier.owner, hex: carrier.hex, type: carrier.type, cu: carrier.cu })),
  players: game.players.map((player) => ({ faction: player.faction, resources: player.resources, tributes: player.tributes,
    claims: player.civilizationClaims, hidden: player.hiddenLegacy })) }, null, 2));
