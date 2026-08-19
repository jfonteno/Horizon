import type { GameHistoryPoint, GameState } from "./types";
import { totalCombatUnits } from "./rules/fleet";

export function playerTradeCount(game: GameState, playerId: number) {
  return game.proposals.filter((proposal) => proposal.kind === "trade" &&
    proposal.status === "accepted" && (proposal.from === playerId || proposal.to === playerId)).length;
}

export function createGameSnapshot(game: GameState, turn: number): GameHistoryPoint {
  return {
    turn,
    era: game.era,
    gate: game.gate,
    players: game.players.map((player) => ({
      playerId: player.id,
      lp: player.lp,
      resources: Object.values(player.resources).reduce((sum, amount) => sum + amount, 0),
      habitats: game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length,
      trades: playerTradeCount(game, player.id),
      tributes: player.tributes,
      military: totalCombatUnits(game, player.id),
      technology: Object.values(player.tech).reduce((sum, level) => sum + level, 0),
    })),
  };
}

export function recordGameSnapshot(game: GameState, turn = game.turn) {
  const snapshot = createGameSnapshot(game, turn);
  const existing = game.history.findIndex((point) => point.turn === turn);
  if (existing >= 0) game.history[existing] = snapshot;
  else game.history.push(snapshot);
  game.history.sort((a, b) => a.turn - b.turn);
  return snapshot;
}
