import type { GameState, SecretOrder } from "../types";

// The twelve playtest cards from Delegate Dawn. Three are revealed per Era.
export const policyDeck = [
  { id: "open-markets", era: 1, name: "Open Markets", effect: "First direct trade each Turn may ignore distance after contact." },
  { id: "infrastructure-grants", era: 1, name: "Infrastructure Grants", effect: "First Center each Era costs 1 less Currency." },
  { id: "cultural-funding", era: 1, name: "Cultural Funding", effect: "First formal agreement each Era costs 1 less Influence." },
  { id: "civilian-investment", era: 2, name: "Civilian Investment", effect: "Economic Centers cost 1 less Currency; military vessels cost 1 more Currency." },
  { id: "arms-expansion", era: 2, name: "Arms Expansion", effect: "First military vessel each Era costs 1 less Material, minimum 1." },
  { id: "rules-of-engagement", era: 2, name: "Rules of Engagement", effect: "First hostile combat each Turn costs its initiator 1 Influence afterward." },
  { id: "scientific-exchange", era: 3, name: "Scientific Exchange", effect: "First Technology advance each Era costs 1 less Research, minimum 1." },
  { id: "strategic-mobilization", era: 3, name: "Strategic Mobilization", effect: "First CU recruitment each Turn gains 3 instead of 2 CU per pair." },
  { id: "isolationist-sentiment", era: 3, name: "Isolationist Sentiment", effect: "Formal agreements cost 1 more Influence." },
  { id: "horizon-priority", era: 4, name: "Horizon Priority", effect: "First Gate Tribute each Era costs 1 less Material; military vessels cost 1 more Currency." },
  { id: "open-commerce", era: 4, name: "Open Commerce", effect: "First trade each Turn grants each party 1 Currency." },
  { id: "arms-limitation", era: 4, name: "Arms Limitation", effect: "Military vessels and CU recruitment cost 1 more Currency." },
] as const;

export function eraPolicyChoices(_seed: number, era: number) {
  return policyDeck.filter((card) => card.era === era).map((card) => card.id);
}

export function startEraPolicy(game: GameState) {
  game.policyElection = { era: game.era, choices: eraPolicyChoices(game.seed, game.era), votes: [] };
}

export function activePolicy(game: GameState) {
  return game.policyElection?.era === game.era ? game.policyElection.activePolicyId : undefined;
}

export function policyUsed(game: GameState, playerId: number, effect: string, period: "turn" | "era" = "era") {
  return !!game.policyUses?.[`${period}:${period === "turn" ? game.turn : game.era}:${playerId}:${effect}`];
}

export function markPolicyUsed(game: GameState, playerId: number, effect: string, period: "turn" | "era" = "era") {
  game.policyUses ||= {};
  game.policyUses[`${period}:${period === "turn" ? game.turn : game.era}:${playerId}:${effect}`] = true;
}

export function policyCost(game: GameState, playerId: number, type: "center" | "carrier" | "recruit" | "technology" | "tribute" | "agreement", cost: Record<string, number>, economic = true) {
  const adjusted = { ...cost };
  const card = activePolicy(game);
  if (type === "center" && economic && ((card === "infrastructure-grants" && !policyUsed(game, playerId, "center")) || card === "civilian-investment"))
    adjusted.currency = Math.max(0, (adjusted.currency || 0) - 1);
  if (type === "carrier") {
    if (card === "civilian-investment" || card === "horizon-priority" || card === "arms-limitation") adjusted.currency = (adjusted.currency || 0) + 1;
    if (card === "arms-expansion" && !policyUsed(game, playerId, "carrier")) adjusted.material = Math.max(1, (adjusted.material || 0) - 1);
  }
  if (type === "recruit" && card === "arms-limitation") adjusted.currency = (adjusted.currency || 0) + 1;
  if (type === "technology" && card === "scientific-exchange" && !policyUsed(game, playerId, "technology")) adjusted.research = Math.max(1, (adjusted.research || 0) - 1);
  if (type === "tribute" && card === "horizon-priority" && !policyUsed(game, playerId, "tribute")) adjusted.material = Math.max(0, (adjusted.material || 0) - 1);
  if (type === "agreement") {
    if (card === "cultural-funding" && !policyUsed(game, playerId, "agreement")) adjusted.influence = Math.max(0, (adjusted.influence || 0) - 1);
    if (card === "isolationist-sentiment") adjusted.influence = (adjusted.influence || 0) + 1;
  }
  return adjusted;
}

export function resolvePolicyVotes(game: GameState, entries: Array<{ playerId: number; order: SecretOrder }>) {
  const election = game.policyElection;
  if (!election || election.era !== game.era || election.votingClosed || (game.turn - 1) % 4 !== 0) return;
  const voted = new Set<number>();
  for (const { playerId, order } of entries) {
    if (order.kind !== "policyVote" || voted.has(playerId) || !election.choices.includes(order.policyId) || !Number.isInteger(order.influence) || order.influence < 1 || game.players[playerId].resources.influence < order.influence) continue;
    voted.add(playerId);
    game.players[playerId].resources.influence -= order.influence;
    election.votes.push({ playerId, policyId: order.policyId, influence: order.influence });
  }
  const totals = election.choices.map((id) => ({ id, votes: election.votes.filter((vote) => vote.policyId === id).reduce((sum, vote) => sum + vote.influence, 0) }));
  const highest = Math.max(...totals.map((entry) => entry.votes));
  const winners = totals.filter((entry) => entry.votes === highest);
  election.activePolicyId = winners.length === 1 && highest > 0 ? winners[0].id : undefined;
  election.votingClosed = true;
  game.log.unshift(election.activePolicyId ? `${policyDeck.find((card) => card.id === election.activePolicyId)?.name} passed for Era ${game.era}.` : `Galactic Policy vote ended without a winner in Era ${game.era}.`);
}
