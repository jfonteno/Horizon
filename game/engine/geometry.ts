import type { MapDefinition } from "../maps";

export function getNeighbors(id:string,map:MapDefinition){
  const [row,column]=id.split("-").map(Number);
  // The rendered board uses odd-q vertical offset coordinates: odd columns
  // sit half a hex lower than even columns. Keep this table reciprocal so
  // every pair of visually touching hexes is adjacent in both directions.
  const directions=column%2
    ? [[-1,0],[1,0],[0,-1],[1,-1],[0,1],[1,1]]
    : [[-1,0],[1,0],[-1,-1],[0,-1],[-1,1],[0,1]];
  return directions
    .map(([r,c])=>[row+r,column+c] as const)
    .filter(([candidateRow,candidateColumn])=>
      candidateRow>=0&&candidateRow<map.rows&&candidateColumn>=0&&candidateColumn<map.columns
    )
    .map(([candidateRow,candidateColumn])=>`${candidateRow}-${candidateColumn}`)
    .filter(candidate=>!map.blocked.has(candidate));
}

export function shortestPath(
  origin: string,
  destination: string,
  map: MapDefinition,
  passable: (id: string, final: boolean) => boolean = () => true,
) {
  if (origin === destination) return [];
  const queue = [origin], previous = new Map<string, string>();
  const seen = new Set([origin]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of getNeighbors(current, map)) {
      if (seen.has(next) || !passable(next, next === destination)) continue;
      previous.set(next, current);
      if (next === destination) {
        const result: string[] = [];
        let cursor = next;
        while (cursor !== origin) { result.unshift(cursor); cursor = previous.get(cursor)!; }
        return result;
      }
      seen.add(next); queue.push(next);
    }
  }
  return [];
}

export function reachableHexes(origin: string, range: number, map: MapDefinition, passable: (id: string, final: boolean) => boolean) {
  const result: string[] = [];
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.columns; col++) {
    const id = `${row}-${col}`;
    if (id !== origin && !map.blocked.has(id)) {
      const path = shortestPath(origin, id, map, passable);
      if (path.length && path.length <= range) result.push(id);
    }
  }
  return result;
}
