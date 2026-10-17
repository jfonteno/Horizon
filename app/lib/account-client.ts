"use client";

import type { AccountPreferences, AccountProvider, AccountRole, AccountStatus, CommanderEmblems, CommanderStatistics, PublicSession, SettledMatchRecord } from "../../game/server/accounts";
import type { ContentEntitlement } from "../../game/entitlements";

const ACCOUNT_TOKEN_KEY = "horizon-account-session-v2";
const RECOVERY_KEY = "horizon-account-recovery-v2";

export type CommanderAccount = {
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

export type LinkedRoom = { code:string;roomName:string;status:string;role:"host"|"player";playerId?:number;displayName:string|null;turn:number;era:number;attentionCount:number;turnDeadlineAt:string|null;updatedAt:string };
export type AccountSession = { account:CommanderAccount;rooms:LinkedRoom[];hiddenRoomCodes?:string[];sessions:PublicSession[];identities:Array<{id:string;provider:"email"|"apple"|"google"|"steam";label:string;createdAt:string;lastUsedAt:string}>;preferences:AccountPreferences;token?:string;recoveryKey?:string };
export type IdentityProviders = { email:boolean;emailDelivery:"email"|"server-console"|"disabled";google:boolean;apple:boolean;steam:boolean };

export function loadAccountToken() { return typeof window === "undefined" ? "" : localStorage.getItem(ACCOUNT_TOKEN_KEY) || ""; }
export function loadRecoveryKey() { return typeof window === "undefined" ? "" : localStorage.getItem(RECOVERY_KEY) || ""; }
export function saveAccountToken(token:string) { if(typeof window!=="undefined") localStorage.setItem(ACCOUNT_TOKEN_KEY,token); }
export function forgetAccountToken() { if(typeof window!=="undefined") localStorage.removeItem(ACCOUNT_TOKEN_KEY); }

async function request(body:Record<string,unknown>) {
  const token=loadAccountToken();
  const response=await fetch("/api/account",{method:"POST",headers:{"content-type":"application/json",...(token?{"authorization":`Bearer ${token}`}:{})},body:JSON.stringify({...body,...(token&&!body.token?{token}: {})}),cache:"no-store"});
  const payload=await response.json() as AccountSession & {error?:string};
  if(!response.ok) throw new Error(payload.error||"Commander account request failed.");
  if(payload.token) saveAccountToken(payload.token);
  if(payload.recoveryKey&&typeof window!=="undefined") localStorage.setItem(RECOVERY_KEY,payload.recoveryKey);
  return payload;
}

export async function createCommanderAccount(displayName:string) { return request({action:"create",displayName,deviceLabel:navigator.userAgent}); }
export async function resumeCommanderAccount(token=loadAccountToken()) { return request({action:"resume",...(token?{token}:{})}); }
export async function recoverCommanderAccount(recoveryKey:string) { const result=await request({action:"recover",recoveryKey,deviceLabel:navigator.userAgent});if(typeof window!=="undefined")localStorage.setItem(RECOVERY_KEY,recoveryKey);return result; }
export async function updateCommanderAccount(displayName:string) { return request({action:"update",displayName}); }
export async function updateCloudPreferences(preferences:Partial<AccountPreferences>) { return request({action:"preferences",preferences}); }
export async function selectCommanderEmblem(emblemId:string) { return request({action:"emblem",emblemId}); }
export async function revokeCommanderSession(sessionId:string){return request({action:"revokeSession",sessionId});}
export async function revokeOtherCommanderSessions(){return request({action:"revokeOthers"});}
export async function unlinkCommanderIdentity(identityId:string){return request({action:"unlinkIdentity",identityId,...(loadRecoveryKey()?{recoveryKey:loadRecoveryKey()}: {})});}
export async function rotateCommanderRecoveryKey(){const result=await request({action:"rotateRecoveryKey"}) as AccountSession&{recoveryKey:string};if(typeof window!=="undefined")localStorage.setItem(RECOVERY_KEY,result.recoveryKey);return result.recoveryKey;}
export async function signOutCommanderAccount(){try{await request({action:"logout"});}finally{forgetAccountToken();}}
export async function deleteCommanderAccount() { const result=await request({action:"delete"}); forgetAccountToken();if(typeof window!=="undefined")localStorage.removeItem(RECOVERY_KEY);return result; }
export function beginProviderSignIn(provider:"apple"|"google"|"steam",mode:"signin"|"link"="signin",returnTo="/"){window.location.assign(`/api/auth/start?provider=${provider}&mode=${mode}&returnTo=${encodeURIComponent(returnTo)}`);}
export async function providerAvailability():Promise<IdentityProviders>{const response=await fetch("/api/auth/providers",{cache:"no-store"});if(!response.ok)return {email:false,emailDelivery:"disabled",google:false,apple:false,steam:false};return ((await response.json()) as {providers:IdentityProviders}).providers;}
export async function startEmailIdentity(email:string,mode:"signin"|"link"="signin",returnTo="/"){
  const token=loadAccountToken();
  const response=await fetch("/api/auth/email/start",{method:"POST",headers:{"content-type":"application/json",...(token?{"authorization":`Bearer ${token}`}:{})},body:JSON.stringify({email,mode,returnTo}),cache:"no-store"});
  const payload=await response.json() as {ok?:boolean;maskedEmail?:string;expiresInSeconds?:number;delivery?:"email"|"server-console";error?:string};
  if(!response.ok)throw new Error(payload.error||"Email verification could not begin.");
  return payload;
}
export async function verifyEmailIdentity(code:string,displayName=""){
  const token=loadAccountToken();
  const response=await fetch("/api/auth/email/verify",{method:"POST",headers:{"content-type":"application/json",...(token?{"authorization":`Bearer ${token}`}:{})},body:JSON.stringify({code,displayName,deviceLabel:navigator.userAgent}),cache:"no-store"});
  const payload=await response.json() as AccountSession&{linked?:boolean;returnTo?:string;error?:string};
  if(!response.ok)throw new Error(payload.error||"Email verification failed.");
  if(payload.token)saveAccountToken(payload.token);
  if(payload.recoveryKey&&typeof window!=="undefined")localStorage.setItem(RECOVERY_KEY,payload.recoveryKey);
  return payload;
}
export async function exportCommanderAccount() {
  const token=loadAccountToken();
  const response=await fetch("/api/account",{method:"POST",headers:{"content-type":"application/json",...(token?{"authorization":`Bearer ${token}`}:{})},body:JSON.stringify({action:"export",...(token?{token}:{})}),cache:"no-store"});
  if(!response.ok) throw new Error(((await response.json()) as {error?:string}).error||"Account export failed.");
  const url=URL.createObjectURL(await response.blob()),a=document.createElement("a");a.href=url;a.download="horizon-account-export.json";a.click();URL.revokeObjectURL(url);
}

async function myGamesRequest(action:"download"|"delete",codes:string[]) {
  const token=loadAccountToken();
  const response=await fetch("/api/my-games",{method:"POST",headers:{"content-type":"application/json",...(token?{"authorization":`Bearer ${token}`}:{})},body:JSON.stringify({action,codes}),cache:"no-store"});
  if(!response.ok){const payload=await response.json() as {error?:string;conflicts?:string[]};throw new Error(payload.error||`Games changed while deleting: ${payload.conflicts?.join(", ")||"refresh and retry"}.`);}
  return response;
}

export async function downloadGameData(codes:string[]) {
  const response=await myGamesRequest("download",codes);
  const filename=response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]||"horizon-games.json";
  const url=URL.createObjectURL(await response.blob());
  const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
}

export async function deleteGames(codes:string[]) {
  const response=await myGamesRequest("delete",codes);
  return await response.json() as {deleted:string[];hidden:string[];conflicts:string[]};
}
