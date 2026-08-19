"use client";

import { useState } from "react";
import { createGameSnapshot, type GameHistoryPoint, type GameState, type PlayerHistoryStats } from "../../game";

type Metric = "lp" | "resources" | "habitats" | "trades";
const chartNames: Record<Metric, { title:string; note:string }> = {
  lp: { title:"Legacy Points", note:"Competitive score after each resolved Turn" },
  resources: { title:"Resource reserves", note:"Material, Currency, Research, and Influence held" },
  habitats: { title:"Controlled Habitats", note:"Outposts, Colonies, and Metropolises controlled" },
  trades: { title:"Completed trades", note:"Cumulative accepted direct-trade proposals" },
};

function MetricChart({game,history,metric}:{game:GameState;history:GameHistoryPoint[];metric:Metric}) {
  const width=560,height=210,left=34,right=12,top=16,bottom=28;
  const values=history.flatMap((point)=>point.players.map((player)=>player[metric]));
  const maximum=Math.max(1,...values),xMax=Math.max(16,...history.map((point)=>point.turn));
  const x=(turn:number)=>left+(turn/xMax)*(width-left-right);
  const y=(value:number)=>top+(1-value/maximum)*(height-top-bottom);
  return <article className="metric-chart">
    <header><div><b>{chartNames[metric].title}</b><small>{chartNames[metric].note}</small></div><strong>MAX {maximum}</strong></header>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chartNames[metric].title} by faction over 16 Turns`}>
      {[0,.25,.5,.75,1].map((ratio)=><g key={ratio}><line x1={left} y1={y(maximum*ratio)} x2={width-right} y2={y(maximum*ratio)} className="chart-grid"/><text x={left-7} y={y(maximum*ratio)+3} textAnchor="end">{Math.round(maximum*ratio)}</text></g>)}
      {[0,4,8,12,16].map((turn)=><g key={turn}><line x1={x(turn)} y1={top} x2={x(turn)} y2={height-bottom} className="chart-grid vertical"/><text x={x(turn)} y={height-8} textAnchor="middle">T{turn}</text></g>)}
      {game.players.map((player)=>{const series=history.map((point)=>({turn:point.turn,value:point.players.find((entry)=>entry.playerId===player.id)?.[metric]||0}));const points=series.map((point)=>`${x(point.turn)},${y(point.value)}`).join(" ");return <g key={player.id}><polyline points={points} fill="none" stroke={player.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{series.map((point)=><circle key={point.turn} cx={x(point.turn)} cy={y(point.value)} r="2.7" fill={player.color}><title>{player.name}, Turn {point.turn}: {point.value}</title></circle>)}</g>;})}
    </svg>
  </article>;
}

export default function EndgameResults({game,newGame}:{game:GameState;newGame:()=>void}) {
  const [view,setView]=useState<"dashboard"|"standings">("dashboard");
  if(!game.result)return null;
  const standings=[...game.players].sort((a,b)=>b.lp-a.lp||b.tributes-a.tributes||b.legacy.universal-a.legacy.universal);
  const history=game.history.length?game.history:[createGameSnapshot(game,16)],final=history.at(-1)!;
  const peak=(playerId:number,key:keyof Pick<PlayerHistoryStats,"resources"|"habitats"|"trades">)=>Math.max(...history.map((point)=>point.players.find((entry)=>entry.playerId===playerId)?.[key]||0));
  return <div className="handoff-overlay endgame-overlay"><div className="endgame-card analytics-endgame" role="dialog" aria-label="Endgame analytics">
    <div className="endgame-summary"><div><p>{game.result.gateSucceeded?"HORIZON GATE STABILIZED":"HORIZON GATE FAILED"}</p><h1>{game.result.gateSucceeded?game.result.winnerIds.length===1?`${game.players[game.result.winnerIds[0]].name} Prevails`:"Shared Victory":"Collective Defeat"}</h1><span>{game.result.reason}</span></div><div className="endgame-tabs"><button className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}>Performance graphs</button><button className={view==="standings"?"active":""} onClick={()=>setView("standings")}>Final standings</button></div></div>
    <div className="analytics-legend">{game.players.map((player)=><span key={player.id}><i style={{background:player.color}}/>{player.name.replace("The ","")}</span>)}</div>
    {view==="dashboard"?<><div className="metric-chart-grid">{(["lp","resources","habitats","trades"] as Metric[]).map((metric)=><MetricChart key={metric} game={game} history={history} metric={metric}/>)}</div><div className="faction-stat-board"><div className="stat-board-head"><b>Faction performance ledger</b><span>Final and peak values across the full simulation</span></div>{standings.map((player,index)=>{const last=final.players.find((entry)=>entry.playerId===player.id)!;return <article key={player.id}><i style={{background:player.color}}/><strong>{index+1}</strong><div><b>{player.name}</b><small>{player.tributes} Gate Tributes · Technology {last.technology} · Military {last.military} CS</small></div><span><small>LP</small><b>{player.lp}</b></span><span><small>Resources</small><b>{last.resources} <em>peak {peak(player.id,"resources")}</em></b></span><span><small>Habitats</small><b>{last.habitats} <em>peak {peak(player.id,"habitats")}</em></b></span><span><small>Trades</small><b>{last.trades}</b></span></article>})}</div></>:<div className="final-standings"><div className="final-head"><b>Final standing</b><small>LP detail and tiebreakers</small></div>{standings.map((player,index)=><article key={player.id} className={game.result!.winnerIds.includes(player.id)?"winner":""}><i style={{background:player.color}}/><strong>{index+1}</strong><div><b>{player.name}</b><small>Universal {player.legacy.universal} · Hidden {player.legacy.hidden} · Civilization {player.legacy.civilization} · Faction {player.legacy.faction} · Manual {player.legacy.manual}</small></div><span>{player.tributes} Tributes</span><em>{player.lp} LP</em></article>)}</div>}
    <button className="primary endgame-new" onClick={newGame}>Start a new civilization cycle</button>
  </div></div>;
}
