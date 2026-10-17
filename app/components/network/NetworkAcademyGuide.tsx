"use client";

import { academyRequirementProgress, academyScenarios, factionLibrary, type GameState, type RoomCommand } from "../../../game";

export default function NetworkAcademyGuide({ game, openPanel, onCommand }: { game: GameState; openPanel: (panel: string) => void; onCommand: (command: RoomCommand) => Promise<void> }) {
  if (game.scenarioId !== "faction-academy" || !game.academy || game.academy.dismissed || game.academy.freePractice) return null;
  const academy = game.academy;
  const scenario = academyScenarios[academy.factionId];
  const exercise = scenario?.stages[academy.stage];
  if (!exercise) return null;
  const faction = factionLibrary[academy.factionId];
  const requirements = academyRequirementProgress(game);
  return <aside className="network-first-horizon-guide network-academy-guide" aria-live="polite" style={{ "--academy-faction": faction.color } as React.CSSProperties}>
    <div className="tutorial-progress"><i style={{ width: `${((academy.stage + 1) / scenario.stages.length) * 100}%` }}/></div>
    <span>{exercise.eyebrow}</span><h2>{exercise.title}</h2><p>{exercise.body}</p><strong>{exercise.objective}</strong>
    <ul className="academy-requirements">{requirements.map(requirement => <li className={requirement.complete ? "complete" : ""} key={requirement.id}>{requirement.complete ? "Complete: " : "Next: "}{requirement.label}</li>)}</ul>
    <section className="academy-step-guide"><b>How to complete this exercise</b><ol>{exercise.checklist.map(item => <li key={item}>{item}</li>)}</ol></section>
    <small className="academy-auto-note">The next exercise loads automatically when these requirements are complete.</small>
    <div className="academy-guide-actions">
      <button className="primary" onClick={() => openPanel(exercise.panel)}>Open {exercise.panel === "faction" ? "Academy" : exercise.panel}</button>
      <button aria-label="Restart exercise" onClick={() => void onCommand({ kind: "restartAcademyStage" })}>Restart</button>
      <button aria-label={academy.stage === 2 ? "Skip exercise and enter free practice" : "Skip exercise"} onClick={() => void onCommand({ kind: "advanceAcademy" })}>{academy.stage === 2 ? "Enter practice" : "Skip"}</button>
      <button aria-label="Hide Academy guide temporarily" onClick={() => void onCommand({ kind: "dismissAcademy" })}>Hide guide</button>
    </div>
  </aside>;
}
