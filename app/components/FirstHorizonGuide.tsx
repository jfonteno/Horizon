"use client";

import { useEffect, useState } from "react";
import { advanceTutorial, firstHorizonLessons, syncTutorial, type GameState } from "../../game";
import { recordOnboardingEvent } from "../lib/onboarding-telemetry";

export default function FirstHorizonGuide({ game, commit, openPanel, openCodex }: {
  game: GameState;
  commit: (game: GameState) => void;
  openPanel: (panel: string) => void;
  openCodex: (entryId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const tutorial = game.tutorial;
  useEffect(() => {
    if (!tutorial || tutorial.dismissed || tutorial.completed) return;
    const next = structuredClone(game);
    if (syncTutorial(next)) commit(next);
  }, [game, tutorial, commit]);
  useEffect(() => {
    if (!tutorial) return;
    localStorage.setItem("horizon-onboarding-v1", JSON.stringify({ started: true, completed: tutorial.completed, dismissed: tutorial.dismissed, step: tutorial.step }));
    recordOnboardingEvent(tutorial.completed ? "tutorial-completed" : tutorial.step === 0 ? "tutorial-started" : "tutorial-step", tutorial.step);
  }, [tutorial]);
  if (!tutorial || tutorial.dismissed) return null;
  const lesson = firstHorizonLessons[tutorial.step] || firstHorizonLessons.at(-1)!;
  const manual = tutorial.step === 0;
  return <aside className={`first-horizon-guide ${tutorial.completed ? "complete" : ""} ${collapsed ? "collapsed" : ""}`} aria-live="polite">
    <button className="guide-toggle" aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>{collapsed ? "Show mission" : "Minimize"}</button>
    <div className="tutorial-progress" aria-label={`Tutorial lesson ${tutorial.step + 1} of ${firstHorizonLessons.length}`}><i style={{ width: `${((tutorial.step + 1) / firstHorizonLessons.length) * 100}%` }} /></div>
    {!collapsed && <>
      <span>{lesson.eyebrow}</span><h2>{lesson.title}</h2><p>{lesson.body}</p><strong>{lesson.objective}</strong>
      <div className="guide-actions">
        {lesson.panel && !tutorial.completed && <button onClick={() => openPanel(lesson.panel!)}>Open {lesson.panel}</button>}
        {lesson.codex && <button onClick={() => openCodex(lesson.codex!)}>Read rule</button>}
        {manual && <button className="primary" onClick={() => { const next=structuredClone(game); advanceTutorial(next,true); commit(next); }}>Begin</button>}
        <button className="quiet" onClick={() => { recordOnboardingEvent("tutorial-abandoned",tutorial.step); const next=structuredClone(game); if(next.tutorial) next.tutorial.dismissed=true; commit(next); }}>Hide guidance</button>
      </div>
    </>}
  </aside>;
}
