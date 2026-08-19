"use client";

import { hiddenLegacyDeck } from "../../game";
import type { BotDecisionReport, GameState } from "../../game";

function reportRevealed(game: GameState, report: BotDecisionReport) {
  return report.turn < game.turn || !!game.result;
}

export default function BotIntelligencePanel({ game }: { game: GameState }) {
  const report = game.botReports[0];
  if (!report) return <section className="ai-report empty-ai-report">
    <div className="section-title"><span>AI analysis</span><small>Waiting</small></div>
    <p>Bot decision reports will appear here after an AI-controlled seat plans its Turn.</p>
  </section>;
  const player = game.players[report.playerId], revealed = reportRevealed(game, report);
  const hiddenState = player.hiddenLegacy[report.era], objectiveRevealed = hiddenState?.scored;
  const objective = objectiveRevealed ? hiddenLegacyDeck.find((card) => card.id === report.hiddenObjectiveId) : undefined;
  return <section className="ai-report">
    <div className="section-title"><span>AI analysis</span><small>{report.profileName}</small></div>
    <div className="ai-report-head"><i style={{background:player.color}}/><div><b>{player.name}</b><span>Turn {report.turn} · {Math.round(report.confidence*100)}% confidence</span></div></div>
    <strong>{report.posture}</strong>
    <p>{report.gateAnalysis}</p>
    <div className="ai-metrics"><span>Candidates <b>{report.candidateCount}</b></span><span>Search nodes <b>{report.planningNodes}</b></span></div>
    <details>
      <summary>Four-Turn strategic forecast</summary>
      {(report.strategicForecast || []).length ? report.strategicForecast.map((forecast,index)=><p key={`${forecast}-${index}`}>{forecast}</p>) : <p>This report predates the four-Turn forecasting model.</p>}
    </details>
    <details>
      <summary>{revealed ? "Selected Orders" : "Selected Orders sealed"}</summary>
      {revealed ? report.selectedOrders.map((order,index)=><div className="ai-choice" key={`${order.label}-${index}`}><b>{order.label}</b><small>Utility {order.score}</small><p>{order.reasons.join(" ")}</p></div>) : <p>Order reasoning remains concealed until simultaneous resolution.</p>}
    </details>
    <details>
      <summary>Objective model</summary>
      <p>{objective ? `${objective.name}: ${report.hiddenObjectiveReason}` : "The selected Hidden objective and its reasoning remain private until Era scoring."}</p>
    </details>
    <details>
      <summary>Threats and counterplay</summary>
      {report.threats.length ? report.threats.map((threat,index)=><p key={`${threat}-${index}`}>{threat}</p>) : <p>No immediate two-Turn threat exceeded the reporting threshold.</p>}
    </details>
    <details>
      <summary>Opponent models</summary>
      {report.opponentModels.length ? report.opponentModels.map((model,index)=><p key={`${model}-${index}`}>{model}</p>) : <p>No rival has enough public history for a useful model yet.</p>}
    </details>
    <details>
      <summary>Commitments and resource routes</summary>
      {report.commitments.length ? report.commitments.map((commitment,index)=><p key={`${commitment}-${index}`}>{commitment}</p>) : <p>No active multi-Turn commitments.</p>}
      {report.diplomacy.length ? report.diplomacy.map((decision,index)=><p key={`${decision}-${index}`}>{decision}</p>) : <p>No diplomacy action was required this Turn.</p>}
    </details>
    <details>
      <summary>Meta-game warnings</summary>
      {report.metaFlags.length ? report.metaFlags.map((flag,index)=><p key={`${flag}-${index}`}>{flag}</p>) : <p>No public exploit, runaway, or Gate-hostage pattern crossed the warning threshold.</p>}
    </details>
    <details>
      <summary>Knowledge boundary</summary><p>{report.knowledgeBoundary}</p>
    </details>
  </section>;
}
