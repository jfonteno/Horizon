"use client";

import { civilizationObjectives, legacyCard, legacyObjectiveProgress, universalLegacy } from "../../../game";
import type { GameState, RoomCommand } from "../../../game";

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
  return <div className="network-legacy-full">
    <header className="network-panel-header"><span>SCORING AND ENDGAME · ERA {game.era}</span><h3>Legacy Archive</h3><p>Automatic objectives are tracked by the server. Manual objectives require your confirmation.</p></header>
    <div className="legacy-breakdown">{Object.entries(player.legacy).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>
    <section className="network-legacy-section"><h4>Hidden Legacy</h4>{hiddenCard ? <article className="network-objective selected"><div><b>{hiddenCard.name}</b><p>{hiddenCard.condition}</p><Progress value={legacyObjectiveProgress(game, playerId, hiddenCard.id)} /></div><strong>{hiddenCard.lp} LP</strong><small>{hidden?.scored ? hidden.completed ? "Scored" : "Not completed" : hiddenCard.automatic ? "Tracked automatically" : hidden?.completed ? "Marked complete" : "Confirmation required"}</small>{!hiddenCard.automatic && !hidden?.scored && <button disabled={busy} onClick={() => void onCommand({ kind: "setHiddenCompleted", completed: !hidden?.completed })}>{hidden?.completed ? "Remove completion" : "Mark completed"}</button>}</article> : hidden?.choices.length ? <div className="network-hidden-choices">{hidden.choices.map((id) => { const card = legacyCard(id)!; return <button disabled={busy} key={id} onClick={() => void onCommand({ kind: "selectHidden", cardId: id })}><strong>{card.lp} LP</strong><b>{card.name}</b><small>{card.condition}</small></button>; })}</div> : <button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "drawHidden" })}>Draw three Hidden objectives</button>}</section>
    <section className="network-legacy-section"><h4>Universal Legacy</h4>{universalLegacy.map((objective) => { const claim = game.universalClaims.find((entry) => entry.objectiveId === objective.id); const progress = legacyObjectiveProgress(game, playerId, objective.id); return <article className={`network-objective ${claim ? "claimed" : objective.era > game.era ? "locked" : ""}`} key={objective.id}><div><b>{objective.name}</b><p>{objective.condition}</p><Progress value={progress} /></div><strong>{objective.lp} LP</strong><small>{claim ? `Claimed by ${game.players[claim.playerId].name}` : objective.era > game.era ? `Unlocks Era ${objective.era}` : objective.automatic ? "Tracked automatically" : "Manual claim"}</small>{!claim && objective.era <= game.era && !objective.automatic && <button disabled={busy || !progress.complete} title={!progress.complete ? "Objective requirements are not yet complete" : "Confirm claim"} onClick={() => void onCommand({ kind: "claimUniversal", objectiveId: objective.id })}>Confirm claim</button>}</article>; })}</section>
    <section className="network-legacy-section"><h4>Civilization Legacy · {player.name}</h4>{civilizationObjectives(player).map((objective) => { const claimed = player.civilizationClaims.includes(objective.id); const progress = legacyObjectiveProgress(game, playerId, objective.id); return <article className={`network-objective ${claimed ? "claimed" : ""}`} key={objective.id}><div><b>{objective.name}</b><p>{objective.condition}</p><Progress value={progress} /></div><strong>{objective.lp} LP</strong><small>{claimed ? "Completed" : objective.automatic ? "Tracked automatically" : "Manual confirmation"}</small>{!claimed && !objective.automatic && <button disabled={busy || !progress.complete} onClick={() => void onCommand({ kind: "claimCivilization", objectiveId: objective.id })}>Confirm completion</button>}</article>; })}</section>
  </div>;
}
