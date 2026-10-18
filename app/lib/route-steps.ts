import type { MapDefinition } from "../../game/maps";
import { getNeighbors } from "../../game/engine/geometry";

/** Route state can outlive a unit selection by one render; no origin means no portal route. */
export function routeUsesPortal(origin: string | undefined, steps: string[], map: MapDefinition) {
  if (!origin) return false;
  return steps.some((step, index) => !getNeighbors(index ? steps[index - 1] : origin, map).includes(step));
}
