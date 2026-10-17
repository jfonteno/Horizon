"use client";

import { useState } from "react";
import { academyScenarios, factionIds, factionLibrary, type FactionId } from "../../../game";
import { factionGuides } from "../../../game/factions/guides";

export default function FactionAcademy({ startTraining, selectedFaction }: { startTraining?: (factionId: FactionId) => void; selectedFaction?: FactionId }) {
  const [selected, setSelected] = useState(selectedFaction || factionIds[0]);
  const faction = factionLibrary[selected];
  const scenario = academyScenarios[selected];
  const guide = factionGuides[selected];
  return <section className="faction-academy"><header className="network-panel-header"><span>HORIZON ACADEMY</span><h3>Faction classes</h3><p>Learn the civilization behind the emblem, then practice its opening, signature ability, and late-game plan.</p></header>
    <nav>{factionIds.map((id) => <button key={id} className={selected === id ? "active" : ""} style={{ "--academy-faction": factionLibrary[id].color } as React.CSSProperties} onClick={() => setSelected(id)}><img src={factionLibrary[id].logo} alt=""/><span><b>{factionLibrary[id].name}</b><small>{factionLibrary[id].role}</small></span></button>)}</nav>
    <article style={{ "--academy-faction": faction.color } as React.CSSProperties}>
      <span>{faction.role.toUpperCase()} CIVILIZATION · {guide?.difficulty || "Varied"}</span><h2>{faction.name}</h2><p>{faction.blurb}</p>
      {startTraining && <button className="primary academy-launch" onClick={() => startTraining(selected)}>Begin {faction.name} training</button>}
      <small className="academy-duration">Three exercises · {scenario?.duration || "guided practice"} · progress does not affect match statistics</small>
      {faction.lore?.length ? <><h4>Identity and world</h4>{faction.lore.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</> : null}
      {guide && <><h4>How they play</h4><p>{guide.style}</p><div className="faction-guide-grid"><section><b>Opening priorities</b><ol>{guide.opening.map((step) => <li key={step}>{step}</li>)}</ol></section><section><b>Middle game</b><p>{guide.midgame}</p></section><section><b>Late game</b><p>{guide.lateGame}</p></section><section><b>Common pitfall</b><p>{guide.watchFor}</p></section></div></>}
      <h4>Starting edge</h4><p>Homeworld produces <b>{faction.homeProduction}</b>. {faction.starting ? `Additional starting package: ${Object.entries(faction.starting.resources || {}).map(([resource, count]) => `${count} ${resource}`).join(", ") || "faction-specific starting assets and technology"}.` : "Review your opening assets on the map before drafting Orders."}</p>
      {scenario && <><h4>Training route</h4><div className="academy-route">{scenario.stages.map((exercise, index) => <section key={exercise.id}><i>{index + 1}</i><span><b>{exercise.title}</b><small>{exercise.eyebrow.split(" · ").at(-1)}</small></span><p>{exercise.body}</p></section>)}</div></>}
      <h4>Core capabilities</h4>{faction.abilities?.map((ability) => <section key={ability.name}><b>{ability.name}</b><small>{ability.unlock || "Inherent"}</small><p>{ability.summary}</p></section>)}
      <h4>Strategic objectives</h4>{faction.objectives.map((objective, index) => <p key={objective}><b>{index + 1}.</b> {objective}</p>)}
    </article>
  </section>;
}
