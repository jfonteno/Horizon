import type { GameState, PlayerController, SecretOrder } from "../types";
import type { ExpansionId } from "../entitlements";

export type RoomRole = "host" | "player" | "spectator";
export type RoomStatus = "lobby" | "active" | "paused" | "complete";
export type RoomPhase = "lobby" | "paused" | "negotiation" | "orders" | "resolving" | "mandatory-decision" | "complete";

export type RoomAttention = {
  id: string;
  kind: "ready" | "hidden" | "proposal" | "message" | "orders" | "capture" | "redistribution" | "timer";
  title: string;
  detail: string;
  turn: number;
};

export type RoomMode = "local" | "network";

export type ChatChannelKind = "all" | "direct" | "group" | "system";

export type ChatAttachment =
  | { kind: "proposal"; proposalId: string }
  | { kind: "hex"; hexId: string };

export type RoomChatChannel = {
  id: string;
  kind: ChatChannelKind;
  name: string;
  participantIds: number[];
  createdBy?: number;
  createdAt: string;
  mutedBy: number[];
};

export type RoomChatMessage = {
  id: string;
  sequence: number;
  channelId: string;
  senderId?: number;
  senderKind: "human" | "bot" | "system";
  text: string;
  at: string;
  era: number;
  turn: number;
  attachment?: ChatAttachment;
};

export type RoomChatReport = {
  id: string;
  messageId: string;
  reporterId: number;
  reason: string;
  at: string;
  status: "open" | "reviewed";
};

export type RoomChatState = {
  channels: RoomChatChannel[];
  messages: RoomChatMessage[];
  reads: Record<string, Record<string, number>>;
  blocks: Array<{ blockerId: number; blockedId: number }>;
  reports: RoomChatReport[];
  nextSequence: number;
};

export type RoomChatSession = {
  channels: RoomChatChannel[];
  messages: RoomChatMessage[];
  unreadByChannel: Record<string, number>;
  blockedPlayerIds: number[];
};

export type RoomModerationItem = RoomChatReport & {
  message?: RoomChatMessage;
  context: RoomChatMessage[];
};

export type RoomGatePledge = {
  playerId: number;
  era: number;
  amount: number;
  updatedAt: string;
  source: "player" | "bot";
};

export type RoomFeedback = {
  playerId: number;
  rating: number;
  difficulty: number;
  wouldPlayAgain: boolean;
  issueTags: Array<"rules" | "interface" | "balance" | "performance" | "connection" | "accessibility">;
  note: string;
  submittedAt: string;
};

export type RoomSeat = {
  playerId: number;
  controller: PlayerController;
  displayName: string | null;
  tokenHash: string | null;
  joinedAt: string | null;
  ready: boolean;
  selectedFaction: string | null;
  randomFaction?: boolean;
  accountId?: string | null;
  commanderEmblem?: string;
};

export type RoomEvent = {
  id: string;
  at: string;
  revision: number;
  type: "system" | "seat" | "phase" | "orders" | "diplomacy" | "combat";
  message: string;
  playerId?: number;
};

export type RoomCommandReceipt = {
  commandId: string;
  playerId: number;
  revision: number;
  message: string;
};

export type RoomAuditEntry = {
  sequence: number;
  commandId: string;
  playerId: number;
  commandKind: string;
  commandLabel: string;
  command: unknown;
  acceptedAt: string;
  revision: number;
  previousHash: string;
  stateHash: string;
  entryHash: string;
};

export type StoredRoom = {
  schemaVersion: number;
  code: string;
  name?: string;
  mode: RoomMode;
  status: RoomStatus;
  revision: number;
  game: GameState;
  initialGame?: GameState;
  availableFactions: string[];
  enabledExpansions: ExpansionId[];
  hostTokenHash: string;
  hostAccountId?: string | null;
  seats: RoomSeat[];
  events: RoomEvent[];
  commandReceipts: RoomCommandReceipt[];
  auditStartRevision?: number;
  initialStateHash?: string;
  audit: RoomAuditEntry[];
  drafts: Array<{ playerId: number; turn: number; orders: SecretOrder[]; updatedAt: string }>;
  chat: RoomChatState;
  gatePledges: RoomGatePledge[];
  feedback: RoomFeedback[];
  turnTimerSeconds: number | null;
  autoStartWhenReady: boolean;
  turnDeadlineAt: string | null;
  turnTimerPausedRemainingMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RoomSummary = {
  code: string;
  name: string;
  mode: RoomMode;
  status: RoomStatus;
  phase: RoomPhase;
  revision: number;
  turn: number;
  era: number;
  activePlayerId: number;
  hostPlayerId: number | null;
  turnTimerSeconds: number | null;
  autoStartWhenReady: boolean;
  turnDeadlineAt: string | null;
  enabledExpansions: ExpansionId[];
  availableFactions: Array<{
    id: string;
    name: string;
    role: string;
    color: string;
    logo?: string;
    blurb?: string;
    lore?: string[];
    abilities?: Array<{ name: string; summary: string; unlock?: string }>;
    objectives?: string[];
    homeProduction?: string;
  }>;
  seats: Array<{
    playerId: number;
    civilization: string;
    faction: string | null;
    controller: PlayerController;
    displayName: string | null;
    claimed: boolean;
    ready: boolean;
    randomFaction: boolean;
    commanderEmblem: string;
    ordersSubmitted: boolean;
  }>;
  recentEvents: RoomEvent[];
  updatedAt: string;
};

export type RoomSession = {
  code: string;
  token: string;
  role: RoomRole;
  playerId?: number;
  revision: number;
  summary: RoomSummary;
  game: GameState;
  privateDraft?: SecretOrder[];
  attention: RoomAttention[];
  chat?: RoomChatSession;
  gatePledges?: RoomGatePledge[];
  moderation?: RoomModerationItem[];
  feedback?: RoomFeedback;
};

export type RoomIdentity = Pick<
  RoomSession,
  "code" | "token" | "role" | "playerId" | "revision"
>;

export type AuthenticatedRoomSeat = {
  room: StoredRoom;
  role: "host" | "player";
  playerId: number;
};

export interface RoomRepository {
  readonly kind: "memory" | "d1" | "disk";
  get(code: string): Promise<StoredRoom | null>;
  put(room: StoredRoom): Promise<void>;
  compareAndSwap(room: StoredRoom, expectedRevision: number): Promise<boolean>;
  delete(code: string, expectedRevision: number): Promise<boolean>;
  findByAccount?(accountId: string): Promise<StoredRoom[]>;
  list?(): Promise<StoredRoom[]>;
  health?(): Promise<{ ok: boolean; detail?: string }>;
}
