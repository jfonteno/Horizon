"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoomCommand, RoomSession } from "../../../game";
import type { ChatAttachment, RoomChatChannel } from "../../../game/server/types";
import PublicFeed from "./PublicFeed";

function channelLabel(channel: RoomChatChannel, session: RoomSession, playerId: number) {
  if (channel.kind !== "direct") return channel.name;
  const other = channel.participantIds.find((id) => id !== playerId);
  return other === undefined ? "Direct Message" : session.game.players[other]?.name || `Seat ${other + 1}`;
}

export default function NetworkCommsPanel({
  session,
  busy,
  selectedHexId,
  onCommand,
  onOpenProposal,
  onOpenHex,
}: {
  session: RoomSession;
  busy: boolean;
  selectedHexId: string;
  onCommand: (command: RoomCommand) => Promise<void>;
  onOpenProposal: (proposalId: string) => void;
  onOpenHex: (hexId: string) => void;
}) {
  const playerId = session.playerId!;
  const chat = session.chat || { channels: [], messages: [], unreadByChannel: {}, blockedPlayerIds: [] };
  const [activeId, setActiveId] = useState(chat.channels.find((channel) => channel.id === "all")?.id || chat.channels[0]?.id || "all");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>();
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const currentPledge = (session.gatePledges || []).find((pledge) => pledge.playerId === playerId && pledge.era === session.game.era)?.amount || 0;
  const [pledgeDraft, setPledgeDraft] = useState<{ era: number; amount: number } | null>(null);
  const marked = useRef<Record<string, number>>({});
  const active = chat.channels.find((channel) => channel.id === activeId) || chat.channels[0];
  const pledge = pledgeDraft?.era === session.game.era ? pledgeDraft.amount : currentPledge;
  const messages = useMemo(() => chat.messages.filter((message) => message.channelId === active?.id), [active?.id, chat.messages]);
  const rivals = session.game.players.filter((player) => player.id !== playerId);
  const pendingProposals = session.game.proposals.filter((proposal) => proposal.status === "pending");

  useEffect(() => {
    const sequence = messages.at(-1)?.sequence || 0;
    if (!active || !sequence || marked.current[active.id] >= sequence || !(chat.unreadByChannel[active.id] || 0)) return;
    marked.current[active.id] = sequence;
    void onCommand({ kind: "markChatRead", channelId: active.id, sequence });
  }, [active, chat.unreadByChannel, messages, onCommand]);

  async function openDirect(otherId: number) {
    const id = `direct-${[playerId, otherId].sort((a, b) => a - b).join("-")}`;
    setActiveId(id);
    await onCommand({ kind: "createChat", participantIds: [playerId, otherId] });
  }

  async function createGroup() {
    if (!groupMembers.length) return;
    await onCommand({ kind: "createChat", participantIds: [playerId, ...groupMembers], name: groupName });
    setGroupOpen(false);
    setGroupName("");
    setGroupMembers([]);
  }

  async function send() {
    if (!active || !text.trim()) return;
    await onCommand({ kind: "sendChat", channelId: active.id, text, attachment });
    setText("");
    setAttachment(undefined);
  }

  const directOther = active?.kind === "direct" ? active.participantIds.find((id) => id !== playerId) : undefined;
  const muted = !!active?.mutedBy.includes(playerId);
  const blocked = directOther !== undefined && chat.blockedPlayerIds.includes(directOther);

  return <div className="network-comms">
    <aside className="comms-sidebar">
      <header><span>MATCH COMMUNICATIONS</span><h3>Conversations</h3></header>
      {session.role === "host" && !!session.moderation?.length && <details className="comms-moderation" open><summary>{session.moderation.length} moderation report{session.moderation.length === 1 ? "" : "s"}</summary>{session.moderation.map((report) => <article key={report.id}><b>{report.message?.senderId === undefined ? "Unknown sender" : session.game.players[report.message.senderId]?.name}</b><p>{report.message?.text || "Message unavailable"}</p><small>{report.reason}</small><div><button onClick={() => void onCommand({ kind: "reviewChatReport", reportId: report.id, action: "dismiss" })}>Dismiss</button><button className="danger" onClick={() => void onCommand({ kind: "reviewChatReport", reportId: report.id, action: "remove" })}>Remove message</button></div></article>)}</details>}
      <div className="comms-channel-list"><button className={activeId === "public-feed" ? "active" : ""} onClick={() => setActiveId("public-feed")}><span><b>Public feed</b><small>Anomalies · Universal Legacy</small></span></button>{chat.channels.map((channel) => <button key={channel.id} className={activeId === channel.id ? "active" : ""} onClick={() => setActiveId(channel.id)}><span><b>{channelLabel(channel, session, playerId)}</b><small>{channel.kind === "group" ? `${channel.participantIds.length} members` : channel.kind}</small></span>{chat.unreadByChannel[channel.id] ? <mark>{chat.unreadByChannel[channel.id]}</mark> : null}</button>)}</div>
      <h4>Direct message</h4>
      <div className="comms-rivals">{rivals.map((rival) => <button key={rival.id} onClick={() => void openDirect(rival.id)} style={{ "--rival": rival.color } as React.CSSProperties}><i />{rival.name}</button>)}</div>
      <button className="comms-new-group" onClick={() => setGroupOpen((open) => !open)}>New group conversation</button>
      {groupOpen && <div className="comms-group-builder"><input aria-label="Group name" maxLength={40} placeholder="Group name (optional)" value={groupName} onChange={(event) => setGroupName(event.target.value)} />{rivals.map((rival) => <label key={rival.id}><input type="checkbox" checked={groupMembers.includes(rival.id)} onChange={(event) => setGroupMembers((current) => event.target.checked ? [...current, rival.id] : current.filter((id) => id !== rival.id))} />{rival.name}</label>)}<button disabled={!groupMembers.length || busy} onClick={() => void createGroup()}>Create group</button></div>}
    </aside>
    <section className="comms-thread">
      {activeId === "public-feed" ? <PublicFeed game={session.game} onOpenHex={onOpenHex}/> : active ? <>
        <header><div><span>{active.kind.toUpperCase()}</span><h3>{channelLabel(active, session, playerId)}</h3></div><div>{active.kind !== "system" && <button onClick={() => void onCommand({ kind: "setChatMuted", channelId: active.id, muted: !muted })}>{muted ? "Unmute" : "Mute"}</button>}{directOther !== undefined && <button className={blocked ? "danger" : ""} onClick={() => void onCommand({ kind: "setPlayerBlocked", playerId: directOther, blocked: !blocked })}>{blocked ? "Unblock" : "Block"}</button>}</div></header>
        <details className="gate-coordination"><summary><span>GATE COORDINATION</span><b>{(session.gatePledges || []).filter((item) => item.era === session.game.era).reduce((sum, item) => sum + item.amount, 0)} pledged this Era</b></summary><div>{session.game.players.map((player) => { const delivered = player.eraTributes[session.game.era - 1] || 0; const promised = (session.gatePledges || []).find((item) => item.playerId === player.id && item.era === session.game.era)?.amount || delivered; return <span key={player.id} style={{ "--pledge": player.color } as React.CSSProperties}><i /><b>{player.name}</b><small>{delivered} delivered · {promised} pledged</small></span>; })}</div><footer><label>Your total Era pledge<input type="number" min={session.game.players[playerId].eraTributes[session.game.era - 1] || 0} max={9} value={pledge} onChange={(event) => setPledgeDraft({ era: session.game.era, amount: Math.max(0, Math.min(9, Number(event.target.value) || 0)) })} /></label><button disabled={busy || pledge === currentPledge} onClick={() => void onCommand({ kind: "setGatePledge", amount: pledge }).then(() => setPledgeDraft(null))}>Update pledge</button></footer></details>
        <div className="comms-messages">{messages.map((message) => {
          const sender = message.senderId === undefined ? "Horizon" : session.game.players[message.senderId]?.name || `Seat ${message.senderId + 1}`;
          const attached = message.attachment;
          return <article key={message.id} className={`${message.senderId === playerId ? "self" : ""} ${message.senderKind}`}><header><b>{sender}</b><small>Era {message.era}, Turn {message.turn} · {new Date(message.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></header><p>{message.text}</p>{attached?.kind === "proposal" && <button className="chat-attachment" onClick={() => onOpenProposal(attached.proposalId)}>Open attached proposal</button>}{attached?.kind === "hex" && <button className="chat-attachment" onClick={() => onOpenHex(attached.hexId)}>Locate sector {attached.hexId}</button>}{message.senderId !== undefined && message.senderId !== playerId && message.senderKind !== "bot" && <button className="report-message" onClick={() => setReportingId(message.id)}>Report</button>}{reportingId === message.id && <div className="chat-report"><input maxLength={240} placeholder="Why should this be reviewed?" value={reportReason} onChange={(event) => setReportReason(event.target.value)} /><button disabled={!reportReason.trim()} onClick={() => { void onCommand({ kind: "reportChatMessage", messageId: message.id, reason: reportReason }); setReportingId(null); setReportReason(""); }}>Submit report</button></div>}</article>;
        })}{!messages.length && <div className="comms-empty">No messages in this conversation yet.</div>}</div>
        {active.kind !== "system" && !blocked && <footer className="comms-compose"><textarea maxLength={1000} placeholder={`Message ${channelLabel(active, session, playerId)}`} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><div className="comms-attachments"><button className={attachment?.kind === "hex" ? "active" : ""} onClick={() => setAttachment({ kind: "hex", hexId: selectedHexId })}>Attach {selectedHexId}</button><select aria-label="Attach proposal" value={attachment?.kind === "proposal" ? attachment.proposalId : ""} onChange={(event) => setAttachment(event.target.value ? { kind: "proposal", proposalId: event.target.value } : undefined)}><option value="">Attach proposal…</option>{pendingProposals.map((proposal) => <option key={proposal.id} value={proposal.id}>{proposal.kind} · {proposal.id.slice(-12)}</option>)}</select>{attachment && <button onClick={() => setAttachment(undefined)}>Clear attachment</button>}</div><button className="primary" disabled={busy || !text.trim()} onClick={() => void send()}>Send</button></footer>}
        {blocked && <div className="comms-blocked">Messages from this player are blocked for this match.</div>}
      </> : <div className="comms-empty">No conversations are available.</div>}
    </section>
  </div>;
}
