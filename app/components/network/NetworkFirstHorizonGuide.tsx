"use client";

import { firstHorizonLessons, type GameState, type RoomCommand } from "../../../game";

export default function NetworkFirstHorizonGuide({ game, openPanel, onCommand }: { game: GameState; openPanel: (panel: string) => void; onCommand: (command: RoomCommand) => Promise<void> }) {
  if (game.scenarioId !== "first-horizon" || !game.tutorial || game.tutorial.dismissed) return null;
  const tutorial = game.tutorial;
  const lesson = firstHorizonLessons[tutorial.step] || firstHorizonLessons.at(-1)!;
  return <aside className="network-first-horizon-guide" aria-live="polite"><div className="tutorial-progress"><i style={{ width: `${((tutorial.step + 1) / firstHorizonLessons.length) * 100}%` }}/></div><span>{lesson.eyebrow}</span><h2>{lesson.title}</h2><p>{lesson.body}</p><strong>{lesson.objective}</strong><div>{lesson.panel && <button onClick={() => openPanel(lesson.panel!)}>Show me</button>}{tutorial.step === 0 && <button className="primary" onClick={() => void onCommand({ kind: "advanceTutorial" })}>Begin lesson</button>}<button onClick={() => void onCommand({ kind: "dismissTutorial" })}>Hide guide</button></div></aside>;
}
