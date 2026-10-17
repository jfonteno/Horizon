"use client";

import type { Dispatch, SetStateAction } from "react";
import type { GameState, SecretOrder } from "../../game";
import { projectedOrderBudget } from "../../game";
import { policyDeck } from "../../game/rules/policy-deck";

export default function PolicyVotePanel({ game, playerId, draft, setDraft }: {
  game: GameState; playerId: number; draft: SecretOrder[]; setDraft: Dispatch<SetStateAction<SecretOrder[]>>;
}) {
  const election = game.policyElection;
  if (!election || election.era !== game.era) return null;
  const voting = (game.turn - 1) % 4 === 0 && !election.votingClosed;
  const selected = draft.find((order) => order.kind === "policyVote");
  return <section className="faction-build-operations" aria-label="Era Policy vote">
    <h4>Era {game.era} Policy</h4>
    {voting ? <p>Commit any available Influence in sealed Orders, or abstain. All bids are spent. A tie enacts no policy. The winner applies when this Turn resolves and lasts through the Era.</p> : <p>Active: {policyDeck.find((card) => card.id === election.activePolicyId)?.name || "No Galactic Policy enacted"}</p>}
    {election.choices.map((id) => {
      const card = policyDeck.find((entry) => entry.id === id);
      return <div key={id}><span><b>{card?.name}</b><small>{card?.effect}</small></span>
        {voting && ([1, 2, 3] as const).map((influence) => {
          const order: SecretOrder = { id: `policy-${game.era}-${playerId}`, kind: "policyVote", policyId: id, influence };
          const next = [...draft.filter((candidate) => candidate.kind !== "policyVote"), order];
          const blocked = !!projectedOrderBudget(game, playerId, next).error;
          return <button key={influence} disabled={blocked} className={selected?.kind === "policyVote" && selected.policyId === id && selected.influence === influence ? "selected" : ""} onClick={() => setDraft(next)}>{influence} I</button>;
        })}
        {voting && <label>Custom bid <input type="number" min={1} max={game.players[playerId].resources.influence} aria-label={`Custom Influence bid for ${card?.name}`} value={selected?.kind === "policyVote" && selected.policyId === id && selected.influence > 3 ? selected.influence : ""} onChange={(event) => {
          const influence = Number(event.target.value);
          if (!Number.isInteger(influence) || influence < 1 || influence > game.players[playerId].resources.influence) return;
          const next: SecretOrder[] = [...draft.filter((candidate) => candidate.kind !== "policyVote"), { id: `policy-${game.era}-${playerId}`, kind: "policyVote", policyId: id, influence }];
          if (!projectedOrderBudget(game, playerId, next).error) setDraft(next);
        }} /></label>}</div>;
    })}
    {selected?.kind === "policyVote" && <button onClick={() => setDraft((current) => current.filter((order) => order.kind !== "policyVote"))}>Abstain</button>}
  </section>;
}
