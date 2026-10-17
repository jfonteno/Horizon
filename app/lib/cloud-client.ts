"use client";

import type { GameState } from "../../game";
import { loadAccountToken } from "./account-client";

export type CloudSaveMetadata={id:string;slotId:"first-horizon"|"academy"|"solo";revision:number;gameSchemaVersion:number;deviceLabel:string;summary:{faction:string;turn:number;era:number;scenarioId?:string};createdAt:string;updatedAt:string;conflictOf:string|null};

function headers(){const token=loadAccountToken();return {"content-type":"application/json",...(token?{"authorization":`Bearer ${token}`}:{})};}
export async function listCloudSaves(){const response=await fetch("/api/cloud",{headers:headers(),cache:"no-store"});if(!response.ok)throw new Error(((await response.json()) as {error?:string}).error||"Cloud saves could not be loaded.");return ((await response.json()) as {saves:CloudSaveMetadata[]}).saves;}
export async function downloadCloudSave(id:string){const response=await fetch(`/api/cloud?id=${encodeURIComponent(id)}`,{headers:headers(),cache:"no-store"});if(!response.ok)throw new Error(((await response.json()) as {error?:string}).error||"Cloud save could not be loaded.");return ((await response.json()) as {save:CloudSaveMetadata&{payload:GameState}}).save;}
export async function uploadCloudSave(game:GameState,expectedRevision:number){const slotId=game.scenarioId==="first-horizon"?"first-horizon":game.scenarioId==="faction-academy"?"academy":"solo",response=await fetch("/api/cloud",{method:"POST",headers:headers(),body:JSON.stringify({slotId,expectedRevision,payload:game,deviceLabel:navigator.userAgent}),cache:"no-store"});const payload=await response.json() as {status?:"saved"|"conflict";save?:CloudSaveMetadata;current?:CloudSaveMetadata;conflict?:CloudSaveMetadata;error?:string};if(!response.ok&&response.status!==409)throw new Error(payload.error||"Cloud save failed.");return payload;}
