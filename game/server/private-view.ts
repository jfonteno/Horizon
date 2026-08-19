import type { GameState, HexKind } from "../types";

export function projectPrivateGame(
  source: GameState,
  playerId: number,
): GameState {
  const game = structuredClone(source);
  const player = game.players[playerId];
  if (!player) throw new Error("That player seat does not exist.");

  const surveyed = new Map(
    player.privateSurveys.map((survey) => [survey.hexId, survey.kind]),
  );
  game.hexes = game.hexes.map((hex) => {
    if (hex.revealed) return hex;
    const privateKind = surveyed.get(hex.id);
    return {
      ...hex,
      kind: (privateKind || "empty") as HexKind,
      surveyedBy: privateKind ? [playerId] : [],
    };
  });
  game.players = game.players.map((candidate) =>
    candidate.id === playerId
      ? candidate
      : {
          ...candidate,
          hiddenLegacy: {},
          privateSurveys: [],
          surveyUsedTurn: undefined,
          forwardScanUsedTurn: undefined,
        },
  );
  game.proposals = game.proposals.filter((proposal) => {
    if (proposal.kind === "technology")
      return proposal.seller === playerId || proposal.buyer === playerId;
    return proposal.from === playerId || proposal.to === playerId;
  });
  game.pendingLabor = game.pendingLabor.filter(
    (pending) => pending.playerId === playerId,
  );
  game.orderProtocol.submissions = game.orderProtocol.submissions.filter(
    (submission) => submission.playerId === playerId,
  );
  game.selectedCarrierIds = game.selectedCarrierIds.filter((carrierId) =>
    game.carriers.some(
      (carrier) => carrier.id === carrierId && carrier.owner === playerId,
    ),
  );
  return game;
}
