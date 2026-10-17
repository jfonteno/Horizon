import { mkdir, open, readFile, readdir, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { replaceRoomFile } from "./atomic-room-save";
import { playtestEntitlements, type ContentEntitlement } from "../entitlements";
import type { StoredRoom } from "./types";

export type AccountProvider = "device" | "email" | "apple" | "google" | "steam";
export type AccountRole = "player" | "analyst" | "support" | "admin" | "owner";
export type AccountStatus = "active" | "suspended" | "deletion-pending" | "deleted";

export type AccountIdentity = {
  id: string;
  provider: Exclude<AccountProvider, "device">;
  subjectHash: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
};

export type AccountSession = {
  id: string;
  tokenHash: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type AccountPreferences = {
  reducedMotion: boolean;
  largerText: boolean;
  highContrast: boolean;
  colorAccessible: boolean;
  musicMuted: boolean;
  musicVolume: number;
  notifyTurns: boolean;
  notifyMessages: boolean;
  notifyProposals: boolean;
  notifyDeadlines: boolean;
};

export type CloudSaveRecord = {
  id: string;
  slotId: "first-horizon" | "academy" | "solo";
  revision: number;
  gameSchemaVersion: number;
  deviceLabel: string;
  summary: { faction: string; turn: number; era: number; scenarioId?: string };
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  conflictOf: string | null;
};

export type CommanderStatistics = {
  gamesPlayed: number;
  gamesCompleted: number;
  wins: number;
  losses: number;
  gateSuccesses: number;
  gateFailures: number;
  highestLegacy: number;
  totalLegacy: number;
  totalTributes: number;
  totalTrades: number;
  totalCombatWins: number;
  gamesByFaction: Record<string, number>;
  winsByFaction: Record<string, number>;
};

export type CommanderEmblems = {
  selected: string;
  unlocked: string[];
};

export type SettledMatchRecord = {
  id: string;
  roomCode: string;
  factionId: string;
  won: boolean;
  gateSucceeded: boolean;
  legacy: number;
  completedAt: string;
};

export type AdminAuditEvent = {
  id: string;
  actorAccountId: string;
  targetAccountId: string;
  action: string;
  reason: string;
  at: string;
};

export type SupportNote = {
  id: string;
  authorAccountId: string;
  body: string;
  at: string;
};

export type StoredAccount = {
  schemaVersion: 3;
  id: string;
  displayName: string;
  status: AccountStatus;
  statusReason: string | null;
  forceRename: boolean;
  roles: AccountRole[];
  recoveryTokenHash: string;
  identities: AccountIdentity[];
  sessions: AccountSession[];
  preferences: AccountPreferences;
  entitlements: ContentEntitlement[];
  cloudSaves: CloudSaveRecord[];
  statistics: CommanderStatistics;
  emblems: CommanderEmblems;
  settledMatches: SettledMatchRecord[];
  hiddenRoomCodes: string[];
  supportNotes: SupportNote[];
  audit: AdminAuditEvent[];
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
};

export type PublicAccount = {
  schemaVersion: 3;
  id: string;
  displayName: string;
  status: AccountStatus;
  forceRename: boolean;
  roles: AccountRole[];
  providers: AccountProvider[];
  entitlements: ContentEntitlement[];
  statistics: CommanderStatistics;
  emblems: CommanderEmblems;
  recentMatches: SettledMatchRecord[];
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
};

export type PublicSession = Omit<AccountSession, "tokenHash"> & { current?: boolean };

export interface AccountRepository {
  readonly kind: "memory" | "disk" | "d1";
  get(id: string): Promise<StoredAccount | null>;
  list(): Promise<StoredAccount[]>;
  findByTokenHash(tokenHash: string): Promise<StoredAccount | null>;
  findByIdentity(provider: AccountIdentity["provider"], subjectHash: string): Promise<StoredAccount | null>;
  put(account: StoredAccount): Promise<void>;
  updateExisting(account: StoredAccount): Promise<boolean>;
  delete(id: string): Promise<void>;
  health?(): Promise<{ ok: boolean; detail?: string }>;
}

const ACCOUNT_ID = /^HZN-[A-Z2-9]{12}$/;
const ACCOUNT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_DAYS = 30;
const DEFAULT_PREFERENCES: AccountPreferences = {
  reducedMotion: false,
  largerText: false,
  highContrast: false,
  colorAccessible: false,
  musicMuted: false,
  musicVolume: 35,
  notifyTurns: true,
  notifyMessages: true,
  notifyProposals: true,
  notifyDeadlines: true,
};

const DEFAULT_STATISTICS: CommanderStatistics = {
  gamesPlayed: 0,
  gamesCompleted: 0,
  wins: 0,
  losses: 0,
  gateSuccesses: 0,
  gateFailures: 0,
  highestLegacy: 0,
  totalLegacy: 0,
  totalTributes: 0,
  totalTrades: 0,
  totalCombatWins: 0,
  gamesByFaction: {},
  winsByFaction: {},
};
let settlementQueue = Promise.resolve();

function randomText(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ACCOUNT_ALPHABET[byte % ACCOUNT_ALPHABET.length]).join("");
}

function opaqueToken(prefix: string) {
  return `${prefix}_${randomText(16)}-${randomText(16)}-${randomText(16)}`;
}

export async function hashAccountToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function providerSubjectHash(provider: string, subject: string) {
  return hashAccountToken(`${provider}:${subject}`);
}

function normalizeAccount(account: StoredAccount): StoredAccount {
  const statistics = { ...DEFAULT_STATISTICS, ...(account.statistics || {}) };
  statistics.gamesByFaction = { ...(account.statistics?.gamesByFaction || {}) };
  statistics.winsByFaction = { ...(account.statistics?.winsByFaction || {}) };
  const earned = Object.entries(statistics.winsByFaction).filter(([, wins]) => wins >= 3).map(([id]) => id);
  const unlocked = [...new Set(["horizon", ...(account.emblems?.unlocked || []), ...earned])];
  return {
    ...account,
    schemaVersion: 3,
    displayName: account.displayName.trim().slice(0, 40) || "Commander",
    status: account.status || "active",
    statusReason: account.statusReason || null,
    forceRename: Boolean(account.forceRename),
    roles: [...new Set<AccountRole>(account.roles?.length ? account.roles : ["player"])],
    identities: account.identities || [],
    sessions: account.sessions || [],
    preferences: { ...DEFAULT_PREFERENCES, ...(account.preferences || {}) },
    entitlements: account.entitlements || playtestEntitlements(),
    cloudSaves: account.cloudSaves || [],
    statistics,
    emblems: {
      selected: unlocked.includes(account.emblems?.selected || "") ? account.emblems!.selected : "horizon",
      unlocked,
    },
    settledMatches: account.settledMatches || [],
    hiddenRoomCodes: account.hiddenRoomCodes || [],
    supportNotes: account.supportNotes || [],
    audit: account.audit || [],
    lastActiveAt: account.lastActiveAt || account.updatedAt,
  };
}

export function publicAccount(account: StoredAccount): PublicAccount {
  const configuredOwners = (process.env.HORIZON_ADMIN_ACCOUNT_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  const roles = configuredOwners.includes(account.id) ? [...new Set<AccountRole>([...account.roles, "owner"])] : account.roles;
  return {
    schemaVersion: 3,
    id: account.id,
    displayName: account.displayName,
    status: account.status,
    forceRename: account.forceRename,
    roles,
    providers: [...new Set<AccountProvider>(["device", ...account.identities.map((identity) => identity.provider)])],
    entitlements: account.entitlements || playtestEntitlements(),
    statistics: structuredClone(account.statistics),
    emblems: structuredClone(account.emblems),
    recentMatches: structuredClone(account.settledMatches.slice(0, 12)),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastActiveAt: account.lastActiveAt,
  };
}

export function publicSessions(account: StoredAccount, currentHash?: string): PublicSession[] {
  return account.sessions.map(({ tokenHash, ...session }) => ({ ...session, current: tokenHash === currentHash }));
}

export class MemoryAccountRepository implements AccountRepository {
  readonly kind = "memory" as const;
  private accounts = new Map<string, StoredAccount>();
  async get(id: string) { const account = this.accounts.get(id); return account ? structuredClone(account) : null; }
  async list() { return [...this.accounts.values()].map((account) => structuredClone(account)); }
  async findByTokenHash(hash: string) { return structuredClone([...this.accounts.values()].find((account) => account.recoveryTokenHash === hash || account.sessions.some((session) => session.tokenHash === hash)) || null); }
  async findByIdentity(provider: AccountIdentity["provider"], hash: string) { return structuredClone([...this.accounts.values()].find((account) => account.identities.some((identity) => identity.provider === provider && identity.subjectHash === hash)) || null); }
  async put(account: StoredAccount) { this.accounts.set(account.id, structuredClone(normalizeAccount(account))); }
  async delete(id: string) { this.accounts.delete(id); }
  async updateExisting(account: StoredAccount) { if (!this.accounts.has(account.id)) return false; await this.put(account); return true; }
  async health() { return { ok: true, detail: "ephemeral" }; }
}

export class DiskAccountRepository implements AccountRepository {
  readonly kind = "disk" as const;
  readonly directory: string;
  private queue = Promise.resolve();
  constructor(directory: string, private readonly replaceFile = replaceRoomFile) { this.directory = resolve(directory); }
  async initialize() { await mkdir(this.directory, { recursive: true, mode: 0o700 }); }
  private path(id: string) { if (!ACCOUNT_ID.test(id)) throw new Error("Invalid Horizon account identifier."); return join(this.directory, `${id}.json`); }
  private exclusive<T>(task: () => Promise<T>) { const current = this.queue.then(task, task); this.queue = current.then(() => undefined, () => undefined); return current; }
  async get(id: string) {
    await this.initialize();
    try { const parsed = JSON.parse(await readFile(this.path(id), "utf8")) as StoredAccount; return [2,3].includes(Number(parsed.schemaVersion)) ? normalizeAccount(parsed) : null; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  async list() {
    await this.initialize();
    const accounts: StoredAccount[] = [];
    for (const file of await readdir(this.directory)) {
      if (!/^HZN-[A-Z2-9]{12}\.json$/.test(file)) continue;
      const account = await this.get(file.slice(0, -5));
      if (account) accounts.push(account);
    }
    return accounts;
  }
  async findByTokenHash(hash: string) { return (await this.list()).find((account) => account.recoveryTokenHash === hash || account.sessions.some((session) => session.tokenHash === hash)) || null; }
  async findByIdentity(provider: AccountIdentity["provider"], hash: string) { return (await this.list()).find((account) => account.identities.some((identity) => identity.provider === provider && identity.subjectHash === hash)) || null; }
  async put(account: StoredAccount) { return this.exclusive(() => this.writeAccount(account)); }
  private async writeAccount(account: StoredAccount) {
    await this.initialize();
    const target = this.path(account.id), temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(`${JSON.stringify(normalizeAccount(account))}\n`, "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    try { await this.replaceFile(temporary, target); }
    catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
  }
  async updateExisting(account: StoredAccount) { return this.exclusive(async () => { if (!await this.get(account.id)) return false; await this.writeAccount(account); return true; }); }
  async delete(id: string) { return this.exclusive(async () => { await unlink(this.path(id)).catch((error) => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }); }); }
  async health() { try { await this.initialize(); return { ok: (await stat(this.directory)).isDirectory() }; } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : "Account storage failed." }; } }
}

export class D1AccountRepository implements AccountRepository {
  readonly kind = "d1" as const;
  private initialized = false;
  constructor(private database: D1Database) {}
  private async initialize() {
    if (this.initialized) return;
    await this.database.prepare("CREATE TABLE IF NOT EXISTS horizon_accounts_v2 (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
    this.initialized = true;
  }
  async get(id: string) { await this.initialize(); const row = await this.database.prepare("SELECT payload FROM horizon_accounts_v2 WHERE id = ?").bind(id).first<{payload:string}>(); return row ? normalizeAccount(JSON.parse(row.payload) as StoredAccount) : null; }
  async list() { await this.initialize(); const result = await this.database.prepare("SELECT payload FROM horizon_accounts_v2 ORDER BY updated_at DESC").all<{payload:string}>(); return (result.results || []).map((row) => normalizeAccount(JSON.parse(row.payload) as StoredAccount)); }
  async findByTokenHash(hash: string) { return (await this.list()).find((account) => account.recoveryTokenHash === hash || account.sessions.some((session) => session.tokenHash === hash)) || null; }
  async findByIdentity(provider: AccountIdentity["provider"], hash: string) { return (await this.list()).find((account) => account.identities.some((identity) => identity.provider === provider && identity.subjectHash === hash)) || null; }
  async put(account: StoredAccount) { await this.initialize(); const normalized=normalizeAccount(account); await this.database.prepare("INSERT INTO horizon_accounts_v2 (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at").bind(normalized.id,JSON.stringify(normalized),normalized.updatedAt).run(); }
  async delete(id: string) { await this.initialize(); await this.database.prepare("DELETE FROM horizon_accounts_v2 WHERE id = ?").bind(id).run(); }
  async updateExisting(account: StoredAccount) { await this.initialize(); const normalized=normalizeAccount(account); const result=await this.database.prepare("UPDATE horizon_accounts_v2 SET payload = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(normalized),normalized.updatedAt,normalized.id).run(); return (result.meta.changes || 0) > 0; }
  async health() { try { await this.initialize(); await this.database.prepare("SELECT 1 AS ok").first(); return {ok:true}; } catch(error) { return {ok:false,detail:error instanceof Error?error.message:"D1 account storage failed."}; } }
}

function accountNow() { return new Date().toISOString(); }
function expiry() { return new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString(); }
function cleanDeviceLabel(value?: string) { return value?.trim().slice(0, 80) || "Horizon device"; }

export class AccountService {
  constructor(private repository: AccountRepository) {}

  private async newAccount(displayName: string, deviceLabel?: string, identity?: { provider: AccountIdentity["provider"]; subject: string; label: string }) {
    const recoveryKey = opaqueToken("hzn_recovery"), token = opaqueToken("hzn_session"), now = accountNow();
    const account: StoredAccount = {
      schemaVersion: 3, id: `HZN-${randomText(12)}`, displayName: displayName.trim().slice(0,40) || "Commander",
      status: "active", statusReason: null, forceRename: false, roles: ["player"],
      recoveryTokenHash: await hashAccountToken(recoveryKey), identities: [], sessions: [{ id: crypto.randomUUID(), tokenHash: await hashAccountToken(token), deviceLabel: cleanDeviceLabel(deviceLabel), createdAt: now, lastUsedAt: now, expiresAt: expiry(), revokedAt: null }],
      preferences: { ...DEFAULT_PREFERENCES }, entitlements: playtestEntitlements(), cloudSaves: [], statistics: structuredClone(DEFAULT_STATISTICS), emblems: { selected: "horizon", unlocked: ["horizon"] }, settledMatches: [], hiddenRoomCodes: [], supportNotes: [], audit: [], createdAt: now, updatedAt: now, lastActiveAt: now,
    };
    if (identity) account.identities.push({ id:crypto.randomUUID(),provider:identity.provider,subjectHash:await providerSubjectHash(identity.provider,identity.subject),label:identity.label.slice(0,80),createdAt:now,lastUsedAt:now });
    await this.repository.put(account);
    const tokenHash=await hashAccountToken(token);
    return { account: publicAccount(account), token, recoveryKey, sessions: publicSessions(account, tokenHash), identities:publicIdentities(account), preferences:account.preferences };
  }

  async create(displayName: string, deviceLabel?: string) { return this.newAccount(displayName, deviceLabel); }

  async authenticate(token: string, allowSuspended = false) {
    const hash = await hashAccountToken(token), account = await this.repository.findByTokenHash(hash);
    if (!account || account.status === "deleted") throw new Error("That commander credential is not valid.");
    if (!allowSuspended && account.status === "suspended") throw new Error(`This Commander account is suspended${account.statusReason ? `: ${account.statusReason}` : "."}`);
    const session = account.sessions.find((candidate) => candidate.tokenHash === hash);
    if (!session) throw new Error("That commander session is not valid.");
    if (session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) throw new Error("That commander session has expired or was revoked.");
    const now=accountNow(), shouldPersist=Date.now()-Date.parse(account.lastActiveAt)>60_000;
    account.lastActiveAt = now;
    if (session) session.lastUsedAt = now;
    if(shouldPersist) await this.repository.put(account);
    return account;
  }

  async resume(token: string) { return publicAccount(await this.authenticate(token)); }

  async session(token: string) {
    const hash=await hashAccountToken(token), account=await this.authenticate(token);
    return { account:publicAccount(account), sessions:publicSessions(account,hash), identities:publicIdentities(account), preferences:account.preferences };
  }

  private async issueSession(account: StoredAccount, deviceLabel?: string, revokeOthers=false) {
    const now=accountNow(), token=opaqueToken("hzn_session"), hash=await hashAccountToken(token);
    if(revokeOthers) for(const session of account.sessions) if(!session.revokedAt) session.revokedAt=now;
    account.sessions.push({id:crypto.randomUUID(),tokenHash:hash,deviceLabel:cleanDeviceLabel(deviceLabel),createdAt:now,lastUsedAt:now,expiresAt:expiry(),revokedAt:null});
    account.updatedAt=now;account.lastActiveAt=now;await this.repository.put(account);
    return {token,account:publicAccount(account),sessions:publicSessions(account,hash),identities:publicIdentities(account),preferences:account.preferences};
  }

  async recover(recoveryKey:string,deviceLabel?:string){const hash=await hashAccountToken(recoveryKey),account=await this.repository.findByTokenHash(hash);if(!account||account.recoveryTokenHash!==hash||account.status==="deleted")throw new Error("That Commander recovery key is not valid.");if(account.status==="suspended")throw new Error(`This Commander account is suspended${account.statusReason?`: ${account.statusReason}`:"."}`);return this.issueSession(account,deviceLabel,true);}

  async signInWithProvider(provider:AccountIdentity["provider"],subject:string,label:string,displayName:string,deviceLabel?:string){const hash=await providerSubjectHash(provider,subject),existing=await this.repository.findByIdentity(provider,hash);if(existing){if(existing.status!=="active")throw new Error(`This Commander account is ${existing.status}.`);const identity=existing.identities.find((candidate)=>candidate.provider===provider&&candidate.subjectHash===hash)!;identity.lastUsedAt=accountNow();return this.issueSession(existing,deviceLabel);}return this.newAccount(displayName,deviceLabel,{provider,subject,label});}

  async linkIdentity(token:string,provider:AccountIdentity["provider"],subject:string,label:string){const account=await this.authenticate(token),hash=await providerSubjectHash(provider,subject),owner=await this.repository.findByIdentity(provider,hash);if(owner&&owner.id!==account.id)throw new Error("That provider identity is already linked to another Commander account.");const existing=account.identities.find((identity)=>identity.provider===provider&&identity.subjectHash===hash),now=accountNow();if(existing){existing.lastUsedAt=now;existing.label=label.slice(0,80);}else account.identities.push({id:crypto.randomUUID(),provider,subjectHash:hash,label:label.slice(0,80),createdAt:now,lastUsedAt:now});account.updatedAt=now;await this.repository.put(account);return publicAccount(account);}

  async linkIdentityForOAuth(accountId:string,provider:AccountIdentity["provider"],subject:string,label:string){const account=await this.repository.get(accountId);if(!account||account.status!=="active")throw new Error("The Commander account for this link request is unavailable.");const hash=await providerSubjectHash(provider,subject),owner=await this.repository.findByIdentity(provider,hash);if(owner&&owner.id!==account.id)throw new Error("That provider identity is already linked to another Commander account.");const existing=account.identities.find((identity)=>identity.provider===provider&&identity.subjectHash===hash),now=accountNow();if(existing){existing.lastUsedAt=now;existing.label=label.slice(0,80);}else account.identities.push({id:crypto.randomUUID(),provider,subjectHash:hash,label:label.slice(0,80),createdAt:now,lastUsedAt:now});account.updatedAt=now;await this.repository.put(account);return publicAccount(account);}

  async unlinkIdentity(token:string,identityId:string,recoveryKey?:string){const account=await this.authenticate(token),index=account.identities.findIndex((identity)=>identity.id===identityId);if(index<0)throw new Error("That linked identity was not found.");if(account.identities.length===1){if(!recoveryKey||await hashAccountToken(recoveryKey)!==account.recoveryTokenHash)throw new Error("Save and confirm your recovery key before unlinking the final platform identity.");}account.identities.splice(index,1);account.updatedAt=accountNow();await this.repository.put(account);return publicAccount(account);}

  async rotateRecoveryKey(token:string){const account=await this.authenticate(token),recoveryKey=opaqueToken("hzn_recovery");account.recoveryTokenHash=await hashAccountToken(recoveryKey);account.updatedAt=accountNow();await this.repository.put(account);return {recoveryKey};}

  async update(token: string, displayName: string) { const account=await this.authenticate(token);account.displayName=displayName.trim().slice(0,40)||account.displayName;account.forceRename=false;account.updatedAt=accountNow();if(!await this.repository.updateExisting(account))throw new Error("This Commander account was deleted. The update was not saved.");return publicAccount(account); }

  async updatePreferences(token:string,preferences:Partial<AccountPreferences>){const account=await this.authenticate(token);account.preferences={...account.preferences,...preferences,musicVolume:Math.max(0,Math.min(100,Number(preferences.musicVolume??account.preferences.musicVolume)))};account.updatedAt=accountNow();await this.repository.put(account);return account.preferences;}

  async selectEmblem(token:string,emblemId:string){const account=await this.authenticate(token);if(!account.emblems.unlocked.includes(emblemId))throw new Error("That Commander emblem has not been unlocked.");account.emblems.selected=emblemId;account.updatedAt=accountNow();await this.repository.put(account);return publicAccount(account);}

  async hideRooms(token: string, codes: string[]) {
    const account = await this.authenticate(token);
    account.hiddenRoomCodes = [...new Set([...account.hiddenRoomCodes, ...codes])];
    account.updatedAt = accountNow();
    if (!await this.repository.updateExisting(account)) throw new Error("This Commander account was deleted. The update was not saved.");
    return account.hiddenRoomCodes;
  }

  async settleCompletedRoom(room:StoredRoom){
    const current=settlementQueue.then(()=>this.applyCompletedRoom(room),()=>this.applyCompletedRoom(room));
    settlementQueue=current.then(()=>undefined,()=>undefined);
    return current;
  }

  private async applyCompletedRoom(room:StoredRoom){
    if(room.mode!=="network"||room.status!=="complete"||!room.game.result||room.game.scenarioId)return {eligible:false,settled:0};
    const humanAccounts=room.seats.filter((seat)=>seat.controller.kind==="human"&&seat.accountId);
    if(new Set(humanAccounts.map((seat)=>seat.accountId)).size<2)return {eligible:false,settled:0};
    const settlementId=`room:${room.code}:${room.game.result.finalizedTurn}`;
    let settled=0;
    for(const seat of humanAccounts){
      const account=await this.repository.get(seat.accountId!);
      if(!account||account.status==="deleted"||account.settledMatches.some((match)=>match.id===settlementId))continue;
      const player=room.game.players[seat.playerId];
      if(!player)continue;
      const won=room.game.result.gateSucceeded&&room.game.result.winnerIds.includes(player.id);
      const stats=account.statistics;
      stats.gamesPlayed++;stats.gamesCompleted++;stats.wins+=won?1:0;stats.losses+=won?0:1;
      stats.gateSuccesses+=room.game.result.gateSucceeded?1:0;stats.gateFailures+=room.game.result.gateSucceeded?0:1;
      stats.highestLegacy=Math.max(stats.highestLegacy,player.lp);stats.totalLegacy+=player.lp;stats.totalTributes+=player.tributes;
      stats.totalTrades+=player.legacyMetrics.directTradeCount||0;stats.totalCombatWins+=player.legacyMetrics.combatWinsAgainst.length;
      stats.gamesByFaction[player.faction]=(stats.gamesByFaction[player.faction]||0)+1;
      if(won)stats.winsByFaction[player.faction]=(stats.winsByFaction[player.faction]||0)+1;
      if((stats.winsByFaction[player.faction]||0)>=3&&!account.emblems.unlocked.includes(player.faction))account.emblems.unlocked.push(player.faction);
      account.settledMatches.push({id:settlementId,roomCode:room.code,factionId:player.faction,won,gateSucceeded:room.game.result.gateSucceeded,legacy:player.lp,completedAt:room.updatedAt});
      account.updatedAt=accountNow();await this.repository.put(account);settled++;
    }
    return {eligible:true,settled};
  }

  async revokeSession(token:string,sessionId:string){const account=await this.authenticate(token),hash=await hashAccountToken(token),session=account.sessions.find((candidate)=>candidate.id===sessionId);if(!session)throw new Error("That session was not found.");if(session.tokenHash===hash)throw new Error("Use sign out to end the current session.");session.revokedAt=accountNow();account.updatedAt=session.revokedAt;await this.repository.put(account);return publicSessions(account,hash);}

  async revokeOtherSessions(token:string){const account=await this.authenticate(token),hash=await hashAccountToken(token),now=accountNow();for(const session of account.sessions)if(session.tokenHash!==hash&&!session.revokedAt)session.revokedAt=now;account.updatedAt=now;await this.repository.put(account);return publicSessions(account,hash);}

  async revokeCurrentSession(token:string){const account=await this.authenticate(token,true),hash=await hashAccountToken(token),session=account.sessions.find((candidate)=>candidate.tokenHash===hash);if(!session)throw new Error("That Commander session was not found.");session.revokedAt=accountNow();account.updatedAt=session.revokedAt;await this.repository.put(account);return {signedOut:true};}

  async saveCloudGame(token:string,slotId:CloudSaveRecord["slotId"],expectedRevision:number,payload:unknown,deviceLabel:string){const account=await this.authenticate(token);const serialized=JSON.stringify(payload);if(new TextEncoder().encode(serialized).byteLength>1_800_000)throw new Error("Cloud save exceeds the 1.8 MB limit.");const game=payload as {schemaVersion?:number;turn?:number;era?:number;scenarioId?:string;players?:Array<{faction?:string}>};if(!game||typeof game!=="object"||!Number.isInteger(game.schemaVersion)||!Array.isArray(game.players))throw new Error("Cloud save is not a valid Horizon game state.");const now=accountNow(),current=account.cloudSaves.filter((save)=>save.slotId===slotId&&!save.conflictOf).sort((a,b)=>b.revision-a.revision)[0];const summary={faction:String(game.players[0]?.faction||"unknown"),turn:Number(game.turn||1),era:Number(game.era||1),...(game.scenarioId?{scenarioId:game.scenarioId}:{})};if(current&&current.revision!==expectedRevision){const conflict:CloudSaveRecord={id:crypto.randomUUID(),slotId,revision:current.revision,gameSchemaVersion:game.schemaVersion!,deviceLabel:cleanDeviceLabel(deviceLabel),summary,payload,createdAt:now,updatedAt:now,conflictOf:current.id};account.cloudSaves.push(conflict);account.updatedAt=now;await this.repository.put(account);return {status:"conflict" as const,current:cloudSaveMetadata(current),conflict:cloudSaveMetadata(conflict)};}const record:CloudSaveRecord={id:current?.id||crypto.randomUUID(),slotId,revision:(current?.revision||0)+1,gameSchemaVersion:game.schemaVersion!,deviceLabel:cleanDeviceLabel(deviceLabel),summary,payload,createdAt:current?.createdAt||now,updatedAt:now,conflictOf:null};if(current)account.cloudSaves[account.cloudSaves.indexOf(current)]=record;else account.cloudSaves.push(record);account.updatedAt=now;await this.repository.put(account);return {status:"saved" as const,save:cloudSaveMetadata(record)};}

  async cloudSaves(token:string){const account=await this.authenticate(token);return account.cloudSaves.map(cloudSaveMetadata);}
  async cloudSave(token:string,id:string){const account=await this.authenticate(token),save=account.cloudSaves.find((candidate)=>candidate.id===id);if(!save)throw new Error("That cloud save was not found.");return save;}

  async export(token: string) { const account=await this.authenticate(token,true);return {account:publicAccount(account),identities:account.identities.map(publicIdentity),sessions:publicSessions(account),preferences:account.preferences,cloudSaves:account.cloudSaves.map((save)=>structuredClone(save)),matchHistory:account.settledMatches,supportNotes:account.supportNotes}; }
  async delete(token: string) { const account=await this.authenticate(token,true);await this.anonymize(account,account.id,"Player requested account deletion.");return {deleted:true,accountId:account.id,deletedAt:accountNow()}; }

  async listAccounts(query=""){const normalized=query.trim().toLowerCase();return (await this.repository.list()).filter((account)=>!normalized||account.id.toLowerCase().includes(normalized)||account.displayName.toLowerCase().includes(normalized)||account.status.includes(normalized)).map((account)=>({account:publicAccount(account),sessionCount:account.sessions.filter((session)=>!session.revokedAt&&Date.parse(session.expiresAt)>Date.now()).length,cloudSaveCount:account.cloudSaves.length,noteCount:account.supportNotes.length}));}
  async getAdminAccount(id:string){const account=await this.repository.get(id);if(!account)throw new Error("Commander account not found.");return {account:publicAccount(account),identities:account.identities.map(publicIdentity),sessions:publicSessions(account),preferences:account.preferences,cloudSaves:account.cloudSaves.map(cloudSaveMetadata),supportNotes:account.supportNotes,audit:account.audit};}
  async adminOverview(){const accounts=await this.repository.list(),now=Date.now(),active=(days:number)=>accounts.filter((account)=>now-Date.parse(account.lastActiveAt)<=days*86_400_000).length;return {totalAccounts:accounts.length,active7:active(7),active30:active(30),suspended:accounts.filter((account)=>account.status==="suspended").length,cloudSaves:accounts.reduce((sum,account)=>sum+account.cloudSaves.length,0),providers:{device:accounts.length,email:accounts.filter((account)=>account.identities.some((identity)=>identity.provider==="email")).length,apple:accounts.filter((account)=>account.identities.some((identity)=>identity.provider==="apple")).length,google:accounts.filter((account)=>account.identities.some((identity)=>identity.provider==="google")).length,steam:accounts.filter((account)=>account.identities.some((identity)=>identity.provider==="steam")).length}};}

  async adminAction(actor:StoredAccount,targetId:string,action:"suspend"|"unsuspend"|"revoke-sessions"|"force-rename"|"note"|"delete"|"detach-identity"|"delete-cloud-save"|"promote-cloud-save",reason:string,value?:string){if(!reason.trim())throw new Error("An administrative reason is required.");const target=await this.repository.get(targetId);if(!target)throw new Error("Commander account not found.");const now=accountNow();if(action==="suspend"){target.status="suspended";target.statusReason=reason.trim().slice(0,240);for(const session of target.sessions)if(!session.revokedAt)session.revokedAt=now;}else if(action==="unsuspend"){target.status="active";target.statusReason=null;}else if(action==="revoke-sessions"){for(const session of target.sessions)if(!session.revokedAt)session.revokedAt=now;}else if(action==="force-rename"){target.forceRename=true;}else if(action==="note"){target.supportNotes.unshift({id:crypto.randomUUID(),authorAccountId:actor.id,body:(value||reason).trim().slice(0,1000),at:now});}else if(action==="detach-identity"){const index=target.identities.findIndex((identity)=>identity.id===value);if(index<0)throw new Error("That linked identity was not found.");target.identities.splice(index,1);}else if(action==="delete-cloud-save"){const index=target.cloudSaves.findIndex((save)=>save.id===value);if(index<0)throw new Error("That cloud save was not found.");target.cloudSaves.splice(index,1);}else if(action==="promote-cloud-save"){const conflict=target.cloudSaves.find((save)=>save.id===value&&save.conflictOf);if(!conflict)throw new Error("That conflict copy was not found.");const current=target.cloudSaves.filter((save)=>save.slotId===conflict.slotId&&!save.conflictOf).sort((a,b)=>b.revision-a.revision)[0],promoted:CloudSaveRecord={...conflict,id:current?.id||crypto.randomUUID(),revision:(current?.revision||0)+1,createdAt:current?.createdAt||now,updatedAt:now,conflictOf:null};if(current)target.cloudSaves[target.cloudSaves.indexOf(current)]=promoted;else target.cloudSaves.push(promoted);target.cloudSaves=target.cloudSaves.filter((save)=>save.id!==conflict.id);}else if(action==="delete"){await this.anonymize(target,actor.id,reason);return this.getAdminAccount(targetId);}target.audit.unshift({id:crypto.randomUUID(),actorAccountId:actor.id,targetAccountId:target.id,action,reason:reason.trim().slice(0,500),at:now});target.updatedAt=now;await this.repository.put(target);return this.getAdminAccount(targetId);}

  private async anonymize(account:StoredAccount,actorAccountId:string,reason:string){const now=accountNow();account.displayName="Deleted Commander";account.status="deleted";account.statusReason=null;account.forceRename=false;account.identities=[];account.sessions=[];account.preferences={...DEFAULT_PREFERENCES};account.cloudSaves=[];account.statistics=structuredClone(DEFAULT_STATISTICS);account.emblems={selected:"horizon",unlocked:["horizon"]};account.settledMatches=[];account.supportNotes=[];account.recoveryTokenHash=await hashAccountToken(opaqueToken("deleted"));account.audit.unshift({id:crypto.randomUUID(),actorAccountId,targetAccountId:account.id,action:"delete",reason:reason.slice(0,500),at:now});account.updatedAt=now;await this.repository.put(account);}
}

export function cloudSaveMetadata(save:CloudSaveRecord){return {id:save.id,slotId:save.slotId,revision:save.revision,gameSchemaVersion:save.gameSchemaVersion,deviceLabel:save.deviceLabel,summary:save.summary,createdAt:save.createdAt,updatedAt:save.updatedAt,conflictOf:save.conflictOf};}

function publicIdentity(identity:AccountIdentity){return {id:identity.id,provider:identity.provider,label:identity.label,createdAt:identity.createdAt,lastUsedAt:identity.lastUsedAt};}

export function publicIdentities(account:StoredAccount){return account.identities.map(publicIdentity);}

export function accountHasRole(account:StoredAccount,roles:AccountRole[]){const effective=publicAccount(account).roles;return roles.some((role)=>effective.includes(role));}
