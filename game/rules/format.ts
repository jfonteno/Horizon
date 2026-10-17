import type { GameState } from "../types";

export type GameFormatId = "four-era" | "five-era" | "first-horizon";

export const gameFormats = {
  "four-era": { id: "four-era", name: "4 Eras / 16 Turns", eras: 4, turnsPerEra: 4 },
  "five-era": { id: "five-era", name: "5 Eras / 20 Turns", eras: 5, turnsPerEra: 4 },
  "first-horizon": { id: "first-horizon", name: "First Horizon / 8 Turns", eras: 2, turnsPerEra: 4 },
} as const;

export const publicGameFormatIds: GameFormatId[] = ["four-era", "five-era"];

export function formatRules(gameOrFormat: Pick<GameState, "format"> | GameFormatId) {
  const id = typeof gameOrFormat === "string" ? gameOrFormat : gameOrFormat.format;
  return gameFormats[id || "four-era"];
}

export const totalTurns = (game: Pick<GameState, "format">) =>
  formatRules(game).eras * formatRules(game).turnsPerEra;

export const finalEra = (game: Pick<GameState, "format">) => formatRules(game).eras;

export const gateTarget = (game: Pick<GameState, "format" | "players">) =>
  (formatRules(game).eras - 1) * game.players.length;

export const isFinalEra = (game: Pick<GameState, "format" | "era">) =>
  game.era === finalEra(game);
