"use client";

import { agreementNames, evaluateLegacy, resolveProposal } from "../../game";
import type { DiplomacyProposal, GameState, TradeBundle } from "../../game";

type Props = {
  game: GameState;
  proposalId: string;
  stage: "pass" | "review" | "return";
  setStage: (stage: "pass" | "review" | "return") => void;
  commit: (game: GameState) => void;
  close: () => void;
  flash: (message: string) => void;
};

const resources = ["material", "currency", "research", "labor"] as const;
const bundle = (value: TradeBundle) => resources.filter(resource => value[resource]).map(resource => `${value[resource]} ${resource}`).join(", ") || "nothing";

function recipient(proposal: DiplomacyProposal) {
  return proposal.kind === "technology" ? proposal.buyer : proposal.to;
}

export default function DiplomacyHandoff({ game, proposalId, stage, setStage, commit, close, flash }: Props) {
  const proposal = game.proposals.find(item => item.id === proposalId);
  if (!proposal) return null;
  const recipientId = recipient(proposal);
  const recipientName = game.players[recipientId].name;
  const proposerId = proposal.kind === "technology" ? proposal.seller : proposal.from;
  const proposerName = game.players[proposerId].name;

  function decide(accept: boolean) {
    const draft = structuredClone(game);
    const result = resolveProposal(draft, proposalId, accept);
    flash(result.message);
    if (!result.ok) return;
    evaluateLegacy(draft);
    commit(draft);
    setStage("return");
  }

  return <div className="handoff-overlay" role="dialog" aria-modal="true">
    <div className="handoff-card">
      {stage === "pass" && <><p>PRIVATE DIPLOMACY</p><h1>Pass the device to {recipientName}</h1><span>The map and active civilization’s resources are concealed until the recipient is ready.</span><button className="primary" onClick={() => setStage("review")}>I am {recipientName}</button></>}
      {stage === "review" && <><p>CONFIDENTIAL PROPOSAL // {recipientName}</p><h1>{proposal.kind === "trade" ? "Direct Trade" : proposal.kind === "agreement" ? agreementNames[proposal.agreementType] : "Technology Exchange"}</h1><div className="proposal-summary"><span>From <b>{proposerName}</b></span>{proposal.kind === "trade" && <><span>They give <b>{bundle(proposal.offer)}</b></span><span>You give <b>{bundle(proposal.request)}</b></span></>}{proposal.kind === "agreement" && <><span>Agreement <b>{agreementNames[proposal.agreementType]}</b></span><span>Your Influence cost <b>Confirmed on acceptance</b></span></>}{proposal.kind === "technology" && <><span>Technology <b>{proposal.branch} {proposal.level}</b></span><span>Additional payment <b>{Object.entries(proposal.compensation).filter(([, amount]) => amount).map(([resource, amount]) => `${amount} ${resource}`).join(", ") || "none"}</b></span></>}</div><div className="decision-buttons"><button onClick={() => decide(false)}>Reject</button><button className="primary" onClick={() => decide(true)}>Accept</button></div></>}
      {stage === "return" && <><p>RESPONSE RECORDED</p><h1>Pass the device back to {proposerName}</h1><span>The proposal has been resolved and added to the System Record.</span><button className="primary" onClick={close}>Return to game</button></>}
    </div>
  </div>;
}
