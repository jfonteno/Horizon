import type { GameState, SecretOrder } from "../types";
import { projectedOrderBudget } from "./purchases";
import { gateTarget } from "./format";

// Pure recommendations use only the player's projected, already-visible state.
export function playerHints(game: GameState, playerId: number, draft: SecretOrder[]): string[] {
  const player = game.players[playerId], hints: string[] = [];
  if (!player.hiddenLegacy[game.era]?.selected) hints.push("Select this Era's Hidden Objective in Legacy first.");
  const budget = projectedOrderBudget(game, playerId, draft);
  if (budget.error) hints.push(`Review your queue: ${budget.error}`);
  if (game.carriers.some((vessel) => vessel.owner === playerId && vessel.cu === 0)) hints.push("You have an uncrewed military vessel. Recruit CU at its Habitat, then use Load CU.");
  if (player.explorationVessels.some((vessel) => vessel.readyTurn <= game.turn && !draft.some((order) => ["explorerMove", "explorerScan", "farboundForwardScan"].includes(order.kind) && "vesselId" in order && order.vesselId === vessel.id))) hints.push("Select an Exploration vessel to explore a new route or scan with a Survey Vessel.");
  if (!draft.some((order) => order.kind === "construct")) hints.push("Open Build on a controlled Habitat. You can queue multiple purchases within your shared budget.");
  if (game.gate < gateTarget(game) && !player.eraTributes[game.era - 1] && !draft.some((order) => order.kind === "tribute")) hints.push("Check the Gate ledger and plan this Era's contribution before spending your reserves.");
  if (game.proposals.some((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId))) hints.push("A diplomatic offer is waiting for your response.");
  return hints.length ? hints : ["Review your queued Orders, then seal when ready. You may unseal until the Turn resolves."];
}
