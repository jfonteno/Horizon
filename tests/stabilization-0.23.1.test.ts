import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AccountService, DiskAccountRepository, MemoryAccountRepository, D1AccountRepository, createGame, RoomService, MemoryRoomRepository, executeRoomCommand } from "../game";
import { connectPrivateRoom, isCurrentRoomResponse, saveRoomIdentity, synchronizeRoom } from "../app/lib/room-client";
import { resumeCommanderAccount } from "../app/lib/account-client";
import { enforceRateLimit } from "../game/server/rate-limit";
import { POST as telemetry } from "../app/api/telemetry/route";
import type { RoomSession } from "../game";

test("seat reopening and bot handoff revoke profile recovery", async () => {
  for (const kind of ["resetHumanSeat", "convertSeatToBot", "convertSeatToHuman"] as const) {
    const repository = new MemoryRoomRepository(); const service = new RoomService(repository);
    const host = await service.create(createGame(4,["farbound","helix","foundry","meridian"],"shattered-reach","horizon-base",231),"Host","network");
    const guest = await service.join(host.code,1,"Guest","profile-old");
    const result = await executeRoomCommand(repository,{code:host.code,token:host.token,expectedRevision:guest.revision,commandId:kind,command:kind === "convertSeatToBot" ? {kind,playerId:1,profileId:"strategic-director"} : {kind,playerId:1}});
    assert.equal(result.ok,true);
    assert.equal((await repository.get(host.code))!.seats[1].accountId,null);
    await assert.rejects(()=>service.resumeByAccount(host.code,"profile-old"));
  }
});

test("deleted disk and memory profiles cannot be recreated by a stale update", async context => {
  const directory=await mkdtemp(join(tmpdir(),"horizon-231-")); context.after(()=>rm(directory,{recursive:true,force:true}));
  for(const repository of [new MemoryAccountRepository(),new DiskAccountRepository(directory)]) {
    const service=new AccountService(repository); const created=await service.create("Original");
    const stale=(await repository.get(created.account.id))!;
    await repository.delete(stale.id);
    assert.equal(await repository.updateExisting({...stale,displayName:"Stale"}),false);
    assert.equal(await repository.get(stale.id),null);
  }
});

test("browser recovery retains keys on failure, repairs stale tokens, and rejects delayed revisions", async context => {
  const storage=new Map<string,string>();
  const localStorage={getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)};
  context.mock.method(globalThis,"fetch",async()=>{throw new Error("offline");});
  for(const [key,value] of Object.entries({window:{localStorage},localStorage})) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    context.after(()=>{if(previous) Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  storage.set("horizon-account-token-v1","saved-key");
  await assert.rejects(()=>resumeCommanderAccount());
  assert.equal(storage.get("horizon-account-token-v1"),"saved-key");
  const session={code:"ABC234",token:"new-token",revision:5,role:"player"} as RoomSession;
  saveRoomIdentity({...session,revision:4,token:"stale-token"});
  const actions:string[]=[];
  context.mock.method(globalThis,"fetch",async(_url:unknown,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body)); actions.push(body.action);
    if(body.action==="resume") return Response.json({error:"That resume token is not valid for this room."},{status:400});
    return Response.json(session);
  });
  assert.equal((await connectPrivateRoom(session.code)).token,"new-token");
  assert.deepEqual(actions,["resume","resumeAccount"]);
  actions.length=0; await connectPrivateRoom(session.code,true); assert.deepEqual(actions,["resumeAccount"]);
  assert.equal(isCurrentRoomResponse(session,{...session,revision:4}),false);
  saveRoomIdentity({...session,revision:3,token:"late-token"});
  assert.match(storage.get("horizon-network-room-v1:ABC234")!,/new-token/);
  const paths:string[]=[];
  context.mock.method(globalThis,"fetch",async(url:unknown)=>{paths.push(String(url));return String(url).endsWith("/sync")?Response.json({error:"unavailable"},{status:503}):Response.json({...session,revision:6});});
  assert.equal((await synchronizeRoom(session,new AbortController().signal))!.revision,6);
  assert.deepEqual(paths,["/api/rooms/ABC234/sync","/api/rooms"]);
});

test("D1 SQL shares rate limits and does not resurrect deleted accounts", async context => {
  const db=new DatabaseSync(":memory:"); context.after(()=>db.close());
  const adapter={prepare(sql:string) { let values: (string|number)[]=[]; return {bind(...args:(string|number)[]){values=args;return this;},async run(){const result=db.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}};},async first(){return db.prepare(sql).get(...values)||null;}};}} as unknown as D1Database;
  const runtime=globalThis as typeof globalThis & {__horizonRoomDatabase?:D1Database};
  runtime.__horizonRoomDatabase=adapter; context.after(()=>{delete runtime.__horizonRoomDatabase;});
  const accountRepo=new D1AccountRepository(adapter); const service=new AccountService(accountRepo);
  const created=await service.create("D1");const stale=(await accountRepo.get(created.account.id))!;
  await accountRepo.delete(stale.id);assert.equal(await accountRepo.updateExisting(stale),false);
  const request=new Request("http://localhost",{headers:{"cf-connecting-ip":"test-address"}});
  await enforceRateLimit(request,"test",2); await enforceRateLimit(request,"test",2);
  await assert.rejects(()=>enforceRateLimit(request,"test",2),/Too many/);
  assert.equal(JSON.stringify(db.prepare("SELECT * FROM horizon_rate_limits").all()).includes("test-address"),false);
});

test("telemetry ignores all caller-provided private text", async context => {
  const output:string[]=[];context.mock.method(console,"warn",(value:string)=>output.push(value));
  const response=await telemetry(new Request("http://localhost/api/telemetry",{method:"POST",body:JSON.stringify({category:"render-failure",message:"SECRET",source:"SECRET",path:"SECRET"})}));
  assert.equal(response.status,200);assert.equal(output.join("").includes("SECRET"),false);
  assert.match(output.join(""),/Client render failure/);
});

test("visible Create and Join screens use the profile-aware room helpers", async () => {
  const source = await readFile(new URL("../app/components/MultiplayerRooms.tsx", import.meta.url), "utf8");
  assert.match(source, /createNetworkRoom\(gameFactory\(\), name \|\| "Host", autoStartWhenReady, roomName\)/);
  assert.match(source, /joinNetworkRoom\(code, -1, name\)/);
});

test("room rate limits separate authenticated seats sharing one address", async () => {
  const request = new Request("https://horizon.test/api/rooms", { headers:{"x-forwarded-for":"203.0.113.10"} });
  for (let count=0;count<60;count++) await enforceRateLimit(request,"shared-ip-regression",60,60_000,"seat-a-token");
  await enforceRateLimit(request,"shared-ip-regression",60,60_000,"seat-b-token");
  await assert.rejects(() => enforceRateLimit(request,"shared-ip-regression",60,60_000,"seat-a-token"), /Too many requests/);
});
