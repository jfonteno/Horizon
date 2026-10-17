import type { RoomCommand } from "./command";
import type {
  RoomChatChannel,
  RoomChatMessage,
  RoomChatSession,
  RoomChatState,
  RoomModerationItem,
  StoredRoom,
} from "./types";

const MAX_MESSAGES = 2_000;

function participantIds(room: StoredRoom) {
  return room.seats.map((seat) => seat.playerId);
}

export function createInitialChat(room: Pick<StoredRoom, "seats" | "createdAt" | "game">): RoomChatState {
  const everyone = room.seats.map((seat) => seat.playerId);
  return {
    channels: [
      { id: "all", kind: "all", name: "All Chat", participantIds: everyone, createdAt: room.createdAt, mutedBy: [] },
      { id: "system", kind: "system", name: "System Feed", participantIds: everyone, createdAt: room.createdAt, mutedBy: [] },
    ],
    messages: [{
      id: "system-1",
      sequence: 1,
      channelId: "system",
      senderKind: "system",
      text: "Room communication initialized.",
      at: room.createdAt,
      era: room.game.era,
      turn: room.game.turn,
    }],
    reads: {},
    blocks: [],
    reports: [],
    nextSequence: 2,
  };
}

export function normalizeChat(room: StoredRoom) {
  room.chat ||= createInitialChat(room);
  const everyone = participantIds(room);
  for (const required of [
    { id: "all", kind: "all" as const, name: "All Chat" },
    { id: "system", kind: "system" as const, name: "System Feed" },
  ]) {
    const channel = room.chat.channels.find((candidate) => candidate.id === required.id);
    if (channel) {
      channel.participantIds = everyone;
      channel.mutedBy ||= [];
    } else room.chat.channels.unshift({ ...required, participantIds: everyone, createdAt: room.createdAt, mutedBy: [] });
  }
  room.chat.messages ||= [];
  room.chat.reads ||= {};
  room.chat.blocks ||= [];
  room.chat.reports ||= [];
  room.chat.nextSequence ||= Math.max(0, ...room.chat.messages.map((message) => message.sequence || 0)) + 1;
  room.chat.channels = room.chat.channels.map((channel) => ({ ...channel, mutedBy: channel.mutedBy || [] }));
  room.chat.messages = room.chat.messages.map((message, index) => ({ ...message, sequence: message.sequence || index + 1 }));
}

function blocked(room: StoredRoom, blockerId: number, blockedId: number) {
  return room.chat.blocks.some((entry) => entry.blockerId === blockerId && entry.blockedId === blockedId);
}

function channelFor(room: StoredRoom, channelId: string) {
  return room.chat.channels.find((channel) => channel.id === channelId);
}

function directChannel(room: StoredRoom, a: number, b: number) {
  const participants = [a, b].sort((left, right) => left - right);
  let channel = room.chat.channels.find((candidate) => candidate.kind === "direct" &&
    candidate.participantIds.length === 2 && candidate.participantIds.every((id, index) => id === participants[index]));
  if (!channel) {
    channel = {
      id: `direct-${participants.join("-")}`,
      kind: "direct",
      name: "Direct Message",
      participantIds: participants,
      createdBy: a,
      createdAt: new Date().toISOString(),
      mutedBy: [],
    };
    room.chat.channels.push(channel);
  }
  return channel;
}

function appendMessage(room: StoredRoom, message: Omit<RoomChatMessage, "id" | "sequence" | "at" | "era" | "turn"> & { at?: string }) {
  const sequence = room.chat.nextSequence++;
  const entry: RoomChatMessage = {
    ...message,
    id: `chat-${sequence}`,
    sequence,
    at: message.at || new Date().toISOString(),
    era: room.game.era,
    turn: room.game.turn,
  };
  room.chat.messages.push(entry);
  room.chat.messages = room.chat.messages.slice(-MAX_MESSAGES);
  return entry;
}

export function appendSystemChat(room: StoredRoom, text: string) {
  return appendMessage(room, { channelId: "system", senderKind: "system", text });
}

export function appendDiplomacyChat(room: StoredRoom, from: number, to: number, proposalId: string, text: string) {
  const channel = directChannel(room, from, to);
  return appendMessage(room, {
    channelId: channel.id,
    senderId: from,
    senderKind: room.game.players[from]?.controller.kind === "bot" ? "bot" : "human",
    text,
    attachment: { kind: "proposal", proposalId },
  });
}

export function appendBotDiplomacyChat(room: StoredRoom, botId: number, humanId: number, messages: string[]) {
  if (!messages.length) return;
  const channel = directChannel(room, botId, humanId);
  for (const text of messages) appendMessage(room, { channelId: channel.id, senderId: botId, senderKind: "bot", text });
}

function cleanText(text: string) {
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function checkMessageRate(room: StoredRoom, playerId: number) {
  const now = Date.now();
  const recent = room.chat.messages.filter((message) => message.senderId === playerId && Number.isFinite(Date.parse(message.at)));
  if (recent.filter((message) => now - Date.parse(message.at) < 10_000).length >= 6)
    return "Please wait a moment before sending more messages.";
  if (recent.filter((message) => now - Date.parse(message.at) < 60_000).length >= 30)
    return "The match-chat rate limit has been reached. Try again in a minute.";
  return "";
}

export function executeChatCommand(room: StoredRoom, playerId: number, command: RoomCommand) {
  normalizeChat(room);
  if (command.kind === "createChat") {
    const ids = [...new Set([...command.participantIds, playerId])].sort((a, b) => a - b);
    if (ids.some((id) => !room.seats[id])) return { ok: false, message: "Every conversation participant must occupy this room." };
    if (ids.some((id) => id !== playerId && (blocked(room, playerId, id) || blocked(room, id, playerId))))
      return { ok: false, message: "A blocked player cannot be added to a new private conversation." };
    if (ids.length === 2) {
      const channel = directChannel(room, ids[0], ids[1]);
      return { ok: true, message: `Direct conversation ready: ${channel.id}.` };
    }
    const exact = room.chat.channels.find((channel) => channel.kind === "group" && channel.participantIds.length === ids.length && channel.participantIds.every((id, index) => id === ids[index]));
    if (exact) return { ok: true, message: `Group conversation ready: ${exact.id}.` };
    const name = cleanText(command.name || "") || `Coalition: ${ids.map((id) => room.game.players[id]?.name || `Seat ${id + 1}`).join(", ")}`;
    const channel: RoomChatChannel = {
      id: `group-${crypto.randomUUID()}`,
      kind: "group",
      name: name.slice(0, 40),
      participantIds: ids,
      createdBy: playerId,
      createdAt: new Date().toISOString(),
      mutedBy: [],
    };
    room.chat.channels.push(channel);
    appendMessage(room, { channelId: channel.id, senderKind: "system", text: `${room.game.players[playerId].name} opened this group conversation.` });
    return { ok: true, message: `Group conversation ready: ${channel.id}.` };
  }
  if (command.kind === "sendChat") {
    if (room.status === "complete") return { ok: false, message: "Completed-room chat is archived read-only." };
    const channel = channelFor(room, command.channelId);
    if (!channel || channel.kind === "system" || !channel.participantIds.includes(playerId))
      return { ok: false, message: "That conversation is not available to this player." };
    if (channel.kind === "direct") {
      const other = channel.participantIds.find((id) => id !== playerId);
      if (other !== undefined && blocked(room, other, playerId)) return { ok: false, message: "That player is not accepting direct messages from you." };
    }
    const limited = checkMessageRate(room, playerId);
    if (limited) return { ok: false, message: limited };
    const text = cleanText(command.text);
    if (!text) return { ok: false, message: "Enter a message before sending." };
    if (/(?:https?:\/\/|www\.)/i.test(text)) return { ok: false, message: "External links are disabled in match chat." };
    const attachment = command.attachment;
    if (attachment?.kind === "proposal") {
      const proposal = room.game.proposals.find((candidate) => candidate.id === attachment.proposalId);
      const parties = proposal?.kind === "technology" ? [proposal.seller, proposal.buyer] : proposal ? [proposal.from, proposal.to] : [];
      if (!proposal || !parties.includes(playerId) || !parties.every((id) => channel.participantIds.includes(id)))
        return { ok: false, message: "That proposal cannot be shared in this conversation." };
    }
    if (attachment?.kind === "hex" && !room.game.hexes.some((hex) => hex.id === attachment.hexId))
      return { ok: false, message: "That sector does not exist on this map." };
    appendMessage(room, {
      channelId: channel.id,
      senderId: playerId,
      senderKind: room.game.players[playerId].controller.kind === "bot" ? "bot" : "human",
      text,
      attachment,
    });
    return { ok: true, message: "Message sent." };
  }
  if (command.kind === "markChatRead") {
    const channel = channelFor(room, command.channelId);
    if (!channel?.participantIds.includes(playerId)) return { ok: false, message: "That conversation is not available to this player." };
    room.chat.reads[String(playerId)] ||= {};
    room.chat.reads[String(playerId)][channel.id] = Math.max(room.chat.reads[String(playerId)][channel.id] || 0, command.sequence);
    return { ok: true, message: "Conversation marked read." };
  }
  if (command.kind === "setChatMuted") {
    const channel = channelFor(room, command.channelId);
    if (!channel?.participantIds.includes(playerId) || channel.kind === "system") return { ok: false, message: "That conversation cannot be muted." };
    channel.mutedBy = channel.mutedBy.filter((id) => id !== playerId);
    if (command.muted) channel.mutedBy.push(playerId);
    return { ok: true, message: command.muted ? "Conversation muted." : "Conversation unmuted." };
  }
  if (command.kind === "setPlayerBlocked") {
    if (command.playerId === playerId || !room.seats[command.playerId]) return { ok: false, message: "Choose another player in this room." };
    room.chat.blocks = room.chat.blocks.filter((entry) => !(entry.blockerId === playerId && entry.blockedId === command.playerId));
    if (command.blocked) room.chat.blocks.push({ blockerId: playerId, blockedId: command.playerId });
    return { ok: true, message: command.blocked ? "Player messages blocked for this match." : "Player messages unblocked." };
  }
  if (command.kind === "reportChatMessage") {
    const message = room.chat.messages.find((candidate) => candidate.id === command.messageId);
    const channel = message && channelFor(room, message.channelId);
    if (!message || !channel?.participantIds.includes(playerId) || message.senderId === playerId)
      return { ok: false, message: "That message cannot be reported from this seat." };
    if (!room.chat.reports.some((report) => report.messageId === message.id && report.reporterId === playerId))
      room.chat.reports.push({ id: `report-${crypto.randomUUID()}`, messageId: message.id, reporterId: playerId, reason: cleanText(command.reason), at: new Date().toISOString(), status: "open" });
    return { ok: true, message: "Message reported with its room context." };
  }
  return { ok: false, message: "That is not a communication command." };
}

export function projectRoomChat(room: StoredRoom, playerId: number | undefined): RoomChatSession {
  normalizeChat(room);
  if (playerId === undefined) return { channels: [], messages: [], unreadByChannel: {}, blockedPlayerIds: [] };
  const channels = room.chat.channels.filter((channel) => channel.participantIds.includes(playerId));
  const visibleIds = new Set(channels.map((channel) => channel.id));
  const blockedPlayerIds = room.chat.blocks.filter((entry) => entry.blockerId === playerId).map((entry) => entry.blockedId);
  const messages = room.chat.messages.filter((message) => visibleIds.has(message.channelId) && (message.senderId === undefined || !blockedPlayerIds.includes(message.senderId)));
  const reads = room.chat.reads[String(playerId)] || {};
  const unreadByChannel = Object.fromEntries(channels.map((channel) => [channel.id, messages.filter((message) => message.channelId === channel.id && message.senderId !== playerId && message.sequence > (reads[channel.id] || 0)).length]));
  return { channels: structuredClone(channels), messages: structuredClone(messages), unreadByChannel, blockedPlayerIds };
}

export function projectChatModeration(room: StoredRoom): RoomModerationItem[] {
  normalizeChat(room);
  return room.chat.reports.filter((report) => report.status === "open").map((report) => {
    const message = room.chat.messages.find((candidate) => candidate.id === report.messageId);
    const nearby = message ? room.chat.messages.filter((candidate) => candidate.channelId === message.channelId && Math.abs(candidate.sequence - message.sequence) <= 2) : [];
    return { ...structuredClone(report), message: message ? structuredClone(message) : undefined, context: structuredClone(nearby) };
  });
}
