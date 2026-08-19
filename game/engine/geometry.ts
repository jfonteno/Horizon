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
