import type { TurnReplay } from "../../game/types";

/** Combat locations remain visible after the turn in which they happened. */
export function combatHexesFromReplays(replays: TurnReplay[] = []) {
  const hexes = new Set<string>();
  for (const replay of replays)
    for (const event of replay.events) {
      const match = event.match(/(?:combat at|bombarded)\s+(\d+-\d+)/i);
      if (match) hexes.add(match[1]);
    }
  return hexes;
}
