import type { GameState, PlayerState, Resource } from "../types";

export const technologyBranches=["Military","Economy","Policy","Exploration","Resource"] as const;
export const economicHexKinds=["material","currency","research","influence","labor"] as const;

export const centerCosts:Record<string,Record<string,number>>={
  research:{material:1,currency:2,labor:1}, currency:{material:1,currency:2,labor:1},
  material:{material:2,currency:1,labor:1}, labor:{material:2,currency:2,labor:2},
  influence:{material:1,currency:1,labor:1}
};
export const technologyCosts:Record<number,[number,number,number]>={2:[2,1,2],3:[4,2,3],4:[7,3,5]};
export const tributeCosts:Record<number,Record<string,number>>={
  1:{material:1,currency:1},2:{material:1,currency:1,research:1},
  3:{material:2,currency:1,research:1,labor:1},4:{material:2,currency:2,research:2,labor:1,influence:1}
};

export function canPay(player:PlayerState,cost:Record<string,number>){return Object.entries(cost).every(([key,value])=>(key==="labor"?player.labor:player.resources[key as Resource])>=value)}
export function spend(player:PlayerState,cost:Record<string,number>){Object.entries(cost).forEach(([key,value])=>{if(key==="labor")player.labor-=value;else player.resources[key as Resource]-=value})}

export function marketRate(player: PlayerState, give: Resource, get: Resource) {
  if (give === "influence" || get === "influence" || give === get) return null;
  if (player.tech.Economy < 3 && give !== "currency") return null;
  if (player.tech.Economy >= 4) return 1;
  if (player.tech.Economy === 1 && give === "currency") return 3;
  return 2;
}

export function marketExchange(game: GameState, playerId: number, give: Resource, get: Resource) {
  const player = game.players[playerId], rate = marketRate(player, give, get);
  if (!rate) return { ok: false, message: "That Market exchange is not available at this Economy level." };
  if (player.resources[give] < rate) return { ok: false, message: `You need ${rate} ${give}.` };
  player.resources[give] -= rate;
  player.resources[get]++;
  if (get === "currency") player.legacyMetrics.marketCurrencyEarned++;
  game.log.unshift(`${player.name} traded ${rate} ${give} for 1 ${get}.`);
  return { ok: true, message: `${rate} ${give} converted to 1 ${get}.` };
}
