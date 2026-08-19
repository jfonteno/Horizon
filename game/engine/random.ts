export function seededRandom(seed:number){let state=seed>>>0;return()=>((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296)}
export function shuffle<T>(values:T[],random:()=>number){const output=[...values];for(let i=output.length-1;i;i--){const j=Math.floor(random()*(i+1));[output[i],output[j]]=[output[j],output[i]]}return output}
