"use client";

import { useState } from "react";
import { civilizationObjectives, legacyCard, legacyObjectiveProgress, universalLegacy } from "../../../game";
import type { GameState, RoomCommand } from "../../../game";
import { policyDeck } from "../../../game/rules/policy-deck";

function Progress({ value }: { value: ReturnType<typeof legacyObjectiveProgress> }) {
  const width = value.target ? Math.min(100, Math.round(value.current / value.target * 100)) : 0;
  return <div className={`legacy-progress ${value.complete ? "complete" : ""}`}><div><span>PROGRESS</span><b>{value.label}</b></div><i><span style={{ width: `${width}%` }} /></i></div>;
}

export default function NetworkLegacyPanel({ game, playerId, busy, onCommand }: {
  game: GameState;
  playerId: number;
  busy: boolean;
  onCommand: (command: RoomCommand) => Promise<void>;
}) {
  const player = game.players[playerId];
  const hidden = player.hiddenLegacy[game.era];
  const hiddenCard = legacyCard(hidden?.selected);
  const [policyChoice, setPolicyChoice] = useState("");
  const [policyInfluence, setPolicyInfluence] = useState(1);
  const election = game.policyElection;
  const policyVoting = !!election && election.era === game.era && election.choices.length > 0 &&
    !election.votingClosed && (game.turn - 1) % 4 === 0;
  const sealedVote = election?.votes.find((vote) => vote.playerId === playerId);
  const policyAvailable = player.resources.influence;
  return <div className="network-legacy-full">
    <header className="network-panel-header"><span>SCORING AND ENDGAME · ERA {game.era}</span><h3>Legacy Archive</h3><p>Automatic objectives are tracked by the server. Manual objectives require your confirmation.</p></header>
    <section className="network-legacy-section network-hidden-selection"><h4>Hidden Legacy</h4>{hiddenCard ? <article className="network-objective selected"><div><b>{hiddenCard.name}</b><p>{hiddenCard.condition}</p><Progress value={legacyObjectiveProgress(game, playerId, hiddenCard.id)} /></div><strong>{hiddenCard.lp} LP</strong><small>{hidden?.scored ? hidden.completed ? "Scored" : "Not completed" : hiddenCard.automatic ? "Tracked automatically" : hidden?.completed ? "Marked complete" : "Confirmation required"}</small>{!hiddenCard.automatic && !hidden?.scored && <button disabled={busy} onClick={() => void onCommand({ kind: "setHiddenCompleted", completed: !hidden?.completed })}>{hidden?.completed ? "Remove completion" : "Mark completed"}</button>}</article> : hidden?.choices.length ? <div className="network-hidden-choices">{hidden.choices.map((id) => { const card = legacyCard(id)!; return <button disabled={busy} key={id} onClick={() => void onCommand({ kind: "selectHidden", cardId: id })}><strong>{card.lp} LP</strong><b>{card.name}</b><small>{card.condition}</small></button>; })}</div> : <button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "drawHidden" })}>Draw three Hidden objectives</button>}</section>
    {policyVoting && election && <section className="policy-ballot" aria-label={`Era ${game.era} Policy ballot`}>
      <span>PUBLIC RULE FOR ERA {game.era}</span><h4>Choose the Era Policy</h4>
      <p>Everyone seals a ballot, including players who abstain. You may spend Influence to support one Policy. The winner takes effect after this Turn resolves; tied bids enact no Policy.</p>
      <div className="policy-ballot-options">{election.choices.map((id) => { const card = policyDeck.find((entry) => entry.id === id); return <button type="button" key={id} className={policyChoice === id ? "selected" : ""} aria-pressed={policyChoice === id} disabled={!!sealedVote || !hidden?.selected || busy || policyAvailable < 1} onClick={() => setPolicyChoice(id)}><b>{card?.name}</b><small>{card?.effect}</small></button>; })}</div>
      {sealedVote ? <strong className="policy-ballot-sealed">Ballot sealed: {sealedVote.influence ? `${policyDeck.find((card) => card.id === sealedVote.policyId)?.name} · ${sealedVote.influence} Influence` : "Abstain"}</strong> : <div className="policy-ballot-actions">
        <label>Influence to commit <input type="number" min={1} max={policyAvailable} value={policyInfluence} disabled={busy || !hidden?.selected || policyAvailable < 1} onChange={(event) => setPolicyInfluence(Number(event.target.value))} /></label>
        <button type="button" disabled={busy || !hidden?.selected || !policyChoice || !Number.isInteger(policyInfluence) || policyInfluence < 1 || policyInfluence > policyAvailable} onClick={() => void onCommand({ kind: "sealPolicyVote", policyId: policyChoice, influence: policyInfluence })}>Seal vote</button>
        <button type="button" disabled={busy || !hidden?.selected} onClick={() => void onCommand({ kind: "sealPolicyVote", policyId: "", influence: 0 })}>Seal abstention</button>
      </div>}
      {!hidden?.selected && <small>Select your Hidden Legacy first, then seal a Policy ballot to enter the game.</small>}
    </section>}
    {game.secretHiddenScoring && !game.result && <p>Hidden Objectives are checked at each Era&apos;s end. Your privately banked points are added to the public score only when the game ends. Private bank: {Object.values(player.hiddenLegacy).reduce((sum, state) => sum + (state.bankedPoints || 0), 0)} LP.</p>}
    <div className="legacy-breakdown">{Object.entries(player.legacy).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>
    <div className="legacy-objective-columns">
      <section className="network-legacy-section legacy-universal"><h4>Universal Legacy</h4>{universalLegacy.map((objective) => { const claims = game.universalClaims.filter((entry) => entry.objectiveId === objective.id); const progress = legacyObjectiveProgress(game, playerId, objective.id); return <article className={`network-objective ${claims.length ? "claimed" : objective.era > game.era ? "locked" : ""}`} key={objective.id}><div><b>{objective.name}</b><p>{objective.condition}</p><Progress value={progress} /></div><strong>{objective.lp} LP</strong><small>{claims.length ? `Claimed by ${claims.map((claim) => game.players[claim.playerId].name).join(", ")}` : objective.era > game.era ? `Unlocks Era ${objective.era}` : objective.automatic ? "Tracked automatically" : "Manual claim"}</small>{!claims.length && objective.era <= game.era && !objective.automatic && <button disabled={busy || !progress.complete} title={!progress.complete ? "Objective requirements are not yet complete" : "Confirm claim"} onClick={() => void onCommand({ kind: "claimUniversal", objectiveId: objective.id })}>Confirm claim</button>}</article>; })}</section>
      <section className="network-legacy-section legacy-civilization"><h4>Civilization Legacy · {player.name}</h4>{civilizationObjectives(player).map((objective) => { const claimed = player.civilizationClaims.includes(objective.id); const progress = legacyObjectiveProgress(game, playerId, objective.id); return <article className={`network-objective ${claimed ? "claimed" : ""}`} key={objective.id}><div><b>{objective.name}</b><p>{objective.condition}</p><Progress value={progress} /></div><strong>{objective.lp} LP</strong><small>{claimed ? "Completed" : objective.automatic ? "Tracked automatically" : "Manual confirmation"}</small>{!claimed && !objective.automatic && <button disabled={busy || !progress.complete} onClick={() => void onCommand({ kind: "claimCivilization", objectiveId: objective.id })}>Confirm completion</button>}</article>; })}</section>
    </div>
    <details className="legacy-archive-history"><summary>Your Hidden archive</summary>{Object.entries(player.hiddenLegacy).map(([era, state]) => <p key={era}>Era {era}: {legacyCard(state.selected)?.name || "Not selected"} · {state.bankedPoints ? `${state.bankedPoints} LP privately banked` : state.scored ? state.completed ? "Scored" : "Not completed" : "In progress"}</p>)}</details>
  </div>;
}
