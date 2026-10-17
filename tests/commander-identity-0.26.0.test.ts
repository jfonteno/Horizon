import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AccountService, MemoryAccountRepository, createGame, createOAuthState, readOAuthState } from "../game";

test("Commander Identity issues revocable device sessions and rotates them on recovery",async()=>{
  const repository=new MemoryAccountRepository(),service=new AccountService(repository),created=await service.create("Pathfinder","Desktop");
  await assert.rejects(()=>service.resume(created.recoveryKey),/session is not valid/);
  const second=await service.recover(created.recoveryKey,"Phone");
  await assert.rejects(()=>service.resume(created.token),/expired or was revoked/);
  const active=await service.session(second.token);
  assert.equal(active.sessions.filter(session=>!session.revokedAt).length,1);
  assert.equal(active.sessions.find(session=>session.current)?.deviceLabel,"Phone");
  assert.deepEqual(active.account.providers,["device"]);
});

test("provider identities link once and sign in to the same Horizon account",async()=>{
  const repository=new MemoryAccountRepository(),service=new AccountService(repository),created=await service.create("Architect");
  await service.linkIdentity(created.token,"google","google-subject-1","Google identity");
  await service.linkIdentityForOAuth(created.account.id,"apple","apple-subject-1","Apple identity");
  const signedIn=await service.signInWithProvider("google","google-subject-1","Google identity","Ignored","Tablet");
  assert.equal(signedIn.account.id,created.account.id);
  assert.ok(signedIn.account.providers.includes("google"));
  assert.ok(signedIn.account.providers.includes("apple"));
  const other=await service.create("Other");
  await assert.rejects(()=>service.linkIdentity(other.token,"google","google-subject-1","Google identity"),/already linked/);
});

test("the final provider requires recovery proof and sign out revokes the session",async()=>{
  const service=new AccountService(new MemoryAccountRepository()),created=await service.signInWithProvider("steam","76561198000000000","Steam identity","Commander","Desktop");
  const identity=(await service.session(created.token)).identities[0];
  await assert.rejects(()=>service.unlinkIdentity(created.token,identity.id),/recovery key/);
  const recovery=(await service.rotateRecoveryKey(created.token)).recoveryKey;
  await service.unlinkIdentity(created.token,identity.id,recovery);
  await service.revokeCurrentSession(created.token);
  await assert.rejects(()=>service.resume(created.token),/expired or was revoked/);
});

test("cloud saves preserve concurrent writes as conflict copies",async()=>{
  const service=new AccountService(new MemoryAccountRepository()),created=await service.create("Cloud Commander"),game=createGame(4,["foundry","helix","varkesh","aurelians"],"standard-board","horizon-base",2600);
  const first=await service.saveCloudGame(created.token,"solo",0,game,"Desktop");
  assert.equal(first.status,"saved");
  const stale=structuredClone(game);stale.turn=2;
  const conflict=await service.saveCloudGame(created.token,"solo",0,stale,"Phone");
  assert.equal(conflict.status,"conflict");
  const saves=await service.cloudSaves(created.token);
  assert.equal(saves.length,2);
  assert.equal(saves.filter(save=>Boolean(save.conflictOf)).length,1);
});

test("Horizon Operations actions revoke access and create an audit record",async()=>{
  const repository=new MemoryAccountRepository(),service=new AccountService(repository),owner=await service.create("Owner"),target=await service.create("Target");
  const ownerRecord=(await repository.get(owner.account.id))!;ownerRecord.roles=["player","owner"];await repository.put(ownerRecord);
  await service.adminAction(ownerRecord,target.account.id,"suspend","Security review");
  await assert.rejects(()=>service.resume(target.token),/suspended/);
  const detail=await service.getAdminAccount(target.account.id);
  assert.equal(detail.account.status,"suspended");
  assert.equal(detail.audit[0].action,"suspend");
  assert.equal(JSON.stringify(detail).includes("tokenHash"),false);
  assert.equal(JSON.stringify(detail).includes("subjectHash"),false);
});

test("Horizon Operations can repair a conflict save without exposing its payload",async()=>{
  const repository=new MemoryAccountRepository(),service=new AccountService(repository),owner=await service.create("Owner"),target=await service.create("Target"),game=createGame(4,["foundry","helix","varkesh","aurelians"],"standard-board","horizon-base",2601);
  const ownerRecord=(await repository.get(owner.account.id))!;ownerRecord.roles=["player","owner"];await repository.put(ownerRecord);
  await service.saveCloudGame(target.token,"solo",0,game,"Desktop");
  const conflict=await service.saveCloudGame(target.token,"solo",0,{...game,turn:2},"Phone");
  assert.equal(conflict.status,"conflict");
  if(conflict.status!=="conflict")throw new Error("Expected a conflict save.");
  const repaired=await service.adminAction(ownerRecord,target.account.id,"promote-cloud-save","Player requested conflict recovery",conflict.conflict.id);
  assert.equal(repaired.cloudSaves.length,1);
  assert.equal(repaired.cloudSaves[0].revision,2);
  assert.equal(repaired.cloudSaves[0].conflictOf,null);
  assert.equal(JSON.stringify(repaired).includes('"payload"'),false);
  assert.equal(repaired.audit[0].action,"promote-cloud-save");
});

test("OAuth state is signed, time bounded, and tamper evident",async context=>{
  const previous=process.env.HORIZON_AUTH_SECRET;process.env.HORIZON_AUTH_SECRET="test-secret-that-is-at-least-thirty-two-characters";context.after(()=>{if(previous===undefined)delete process.env.HORIZON_AUTH_SECRET;else process.env.HORIZON_AUTH_SECRET=previous;});
  const created=await createOAuthState("google","link","/settings","HZN-EXAMPLE2345");
  assert.equal((await readOAuthState(created.cookie)).returnTo,"/settings");
  assert.equal((await readOAuthState(created.cookie)).accountId,"HZN-EXAMPLE2345");
  const [payload,signature]=created.cookie.split("."),tampered=`${payload}.${signature[0]==="A"?"B":"A"}${signature.slice(1)}`;
  await assert.rejects(()=>readOAuthState(tampered),/verified/);
});

test("0.26.0 exposes identity, cloud continuity, and protected operations surfaces",async()=>{
  const [shell,admin,accountApi,cloudApi,healthApi]=await Promise.all([
    readFile(new URL("../app/components/ApplicationShell.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/account/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/cloud/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/health/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(shell,/COMMANDER IDENTITY/);
  assert.match(shell,/Continue with/);
  assert.match(admin,/Commander Administration/);
  assert.match(admin,/Private Orders, Hidden Objectives/);
  assert.match(accountApi,/revokeSession/);
  assert.match(cloudApi,/expectedRevision/);
  assert.match(healthApi,/accountSchemaVersion: 3/);
});
