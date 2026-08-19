import { getBotProfile } from "../../bots";
import { takeBotTurn } from "../ai/intelligence";
import type { GameState } from "../types";

export function isBotSeat(game: GameState, playerId: number): boolean {
  return game.players[playerId]?.controller.kind === "bot";
}

export function botSeatIds(game: GameState): number[] {
  return game.players
    .filter((player) => player.controller.kind === "bot")
    .map((player) => player.id);
}

export function humanSeatIds(game: GameState): number[] {
  return game.players
    .filter((player) => player.controller.kind === "human")
    .map((player) => player.id);
}

export function botProfileId(game: GameState, playerId: number): string | undefined {
  const controller = game.players[playerId]?.controller;
  return controller?.kind === "bot" ? controller.profileId : undefined;
}

/**
 * Runs every bot that has not yet submitted Orders for the current Turn.
 *
 * takeBotTurn was originally written for pass-and-play and checks
 * orderProtocol.currentPlayer. Network mode temporarily points that handoff at
 * the bot being executed, then lets the existing bot planner, diplomacy logic,
 * hidden-objective selection, and submitSecretOrders path run unchanged.
 */
export function runPendingBotSeats(game: GameState): {
  acted: number[];
  messages: string[];
} {
  const acted: number[] = [];
  const messages: string[] = [];

  if (game.result || game.orderProtocol.phase !== "orders")
    return { acted, messages };

  for (const player of game.players) {
    if (player.controller.kind !== "bot") continue;
    if (
      game.orderProtocol.submissions.some(
        (submission) => submission.playerId === player.id,
      )
    )
      continue;

    const profile = getBotProfile(player.controller.profileId);
    if (!profile)
      throw new Error(
        `Bot profile '${player.controller.profileId}' is not installed for ${player.name}.`,
      );

    game.orderProtocol.currentPlayer = player.id;
    game.active = player.id;

    const result = takeBotTurn(game, player.id, profile);
    if (!result.ok)
      throw new Error(`${player.name} bot turn failed: ${result.message}`);

    acted.push(player.id);
    messages.push(`${player.name}: ${result.message}`);
  }

  return { acted, messages };
}
