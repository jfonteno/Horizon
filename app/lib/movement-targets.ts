import type { GameState } from "../../game/types";
import { getNeighbors } from "../../game/engine/geometry";
import { mapLibrary } from "../../game/maps";
import { portalNeighbors } from "../../game/rules/portals";

export type MovementMode = "explorer" | "colony" | "military" | "civilian";

/** All destinations a vessel can reach this Turn, with a navigable path for each. */
export function movementTargets(
  game: GameState,
  playerId: number,
  origin: string,
  range: number,
  mode: MovementMode,
  portalAlreadyUsed = false,
): Map<string, string[]> {
  const paths = new Map<string, { steps: string[]; risk: number }>();
  if (!origin || range < 1) return new Map();
  const map = mapLibrary[game.mapId];
  const hexes = new Map(game.hexes.map((hex) => [hex.id, hex]));
  type Route = { at: string; steps: string[]; portalUsed: boolean; risk: number };
  let frontier: Route[] = [{ at: origin, steps: [], portalUsed: portalAlreadyUsed, risk: 0 }];
  const limit = mode === "civilian" ? 1 : range;

  for (let distance = 1; distance <= limit; distance++) {
    const next = new Map<string, Route>();
    for (const route of frontier) {
      const adjacent = getNeighbors(route.at, map);
      const portals = mode !== "civilian" && !route.portalUsed
        ? portalNeighbors(game, playerId, route.at)
        : [];
      for (const id of new Set([...adjacent, ...portals])) {
        const hex = hexes.get(id);
        if (!hex || id === origin || route.steps.includes(id) || hex.kind === "rift" ||
          (mode !== "explorer" && !hex.revealed)) continue;
        const portalUsed = route.portalUsed || !adjacent.includes(id);
        const risk = route.risk + Number(
          (hex.owner !== undefined && hex.owner !== playerId) ||
          game.carriers.some((carrier) => carrier.hex === id && carrier.owner !== playerId) ||
          game.blockades.some((blockade) => blockade.active && blockade.hex === id && blockade.owner !== playerId),
        );
        const steps = [...route.steps, id];
        const candidate = { at: id, steps, portalUsed, risk };
        const key = `${id}:${portalUsed}`;
        const previous = next.get(key);
        if (!previous || risk < previous.risk) next.set(key, candidate);
        const best = paths.get(id);
        if (!best || risk < best.risk || (risk === best.risk && steps.length < best.steps.length))
          paths.set(id, { steps, risk });
      }
    }
    frontier = [...next.values()];
    if (!frontier.length) break;
  }
  return new Map([...paths].map(([id, route]) => [id, route.steps]));
}
