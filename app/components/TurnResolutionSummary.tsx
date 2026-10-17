"use client";

import type { PlayerResolutionBrief, Resource } from "../../game";

const labels: Record<Resource, string> = { material:"Material",currency:"Currency",research:"Research",influence:"Influence" };

export default function TurnResolutionSummary({ brief, close, viewPrevious }: { brief: PlayerResolutionBrief; close: () => void; viewPrevious?: () => void }) {
  const deltas = Object.entries(brief.resourceDelta).filter(([, value]) => value !== 0) as Array<[Resource, number]>;
  return <div className="resolution-overlay" role="dialog" aria-modal="true" aria-labelledby="resolution-title"><article className="resolution-card">
    <header className="resolution-header"><span>ERA {brief.era} · TURN {brief.turn} RESOLVED</span><h2 id="resolution-title">Command briefing</h2></header>
    <div className="resolution-content">
      <div className="resolution-deltas">
        {deltas.map(([resource,value])=><div key={resource}><small>{labels[resource]}</small><b className={value>0?"positive":"negative"}>{value>0?"+":""}{value}</b></div>)}
        {brief.laborDelta !== 0 && <div><small>Labor</small><b className={brief.laborDelta>0?"positive":"negative"}>{brief.laborDelta>0?"+":""}{brief.laborDelta}</b></div>}
        {brief.lpDelta !== 0 && <div><small>Legacy</small><b className="positive">+{brief.lpDelta}</b></div>}
        {brief.habitatDelta !== 0 && <div><small>Habitats</small><b>{brief.habitatDelta>0?"+":""}{brief.habitatDelta}</b></div>}
        {brief.combatUnitDelta !== 0 && <div><small>Combat Units</small><b>{brief.combatUnitDelta>0?"+":""}{brief.combatUnitDelta}</b></div>}
        {brief.tributeDelta !== 0 && <div><small>Gate Tributes</small><b className="positive">+{brief.tributeDelta}</b></div>}
      </div>
      {brief.technology.length > 0 && <p><b>Technology advanced:</b> {brief.technology.join(", ")}</p>}
      <div className="resolution-events">{brief.events.length ? brief.events.map((event,index)=><p key={index}>{event}</p>) : <p>Your Orders resolved without a public event.</p>}</div>
    </div>
    <footer className="resolution-actions">{viewPrevious && <button onClick={viewPrevious}>View Previous Orders</button>}<button className="primary" onClick={close}>Plan next Turn</button></footer>
  </article></div>;
}
