import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGame } from "../game";
import { MemoryAccountRepository } from "../game/server/accounts";
import { MemoryOperationsSettingsRepository, updatePlaytestAccessSettings } from "../game/server/operations";
import { MemoryRoomRepository } from "../game/server/rooms";
import { setAccountRepository, setOperationsSettingsRepository, setRoomRepository } from "../game/server/runtime";
import { POST as roomsPost } from "../app/api/rooms/route";

function game(){return createGame(4,["farbound","helix","foundry","aurelians"],"shattered-reach","horizon-base",33201,[{kind:"human"},{kind:"human"},{kind:"bot",profileId:"strategic-director"},{kind:"bot",profileId:"strategic-director"}]);}
function request(body:object,ip:string){return new Request("https://horizon.test/api/rooms",{method:"POST",headers:{"content-type":"application/json","cf-connecting-ip":ip},body:JSON.stringify(body)});}

test("playtest access settings retain an operator audit trail",async()=>{const repository=new MemoryOperationsSettingsRepository(),current=await repository.get(),next=updatePlaytestAccessSettings(current,{multiplayerVerification:"room-code",spectatorsAllowed:false},"operator-1","Open an invited test window");await repository.put(next);const stored=await repository.get();assert.equal(stored.multiplayerVerification,"room-code");assert.equal(stored.spectatorsAllowed,false);assert.equal(stored.audit.at(-1)?.actorAccountId,"operator-1");assert.match(stored.audit.at(-1)?.reason||"",/invited test/);});

test("Room Code verification admits an invited display name without an account",async()=>{setRoomRepository(new MemoryRoomRepository());setAccountRepository(new MemoryAccountRepository());setOperationsSettingsRepository(new MemoryOperationsSettingsRepository({...await new MemoryOperationsSettingsRepository().get(),multiplayerVerification:"room-code"}));const response=await roomsPost(request({action:"create",game:game(),displayName:"Guest Host",mode:"network"},"203.0.113.82"));assert.equal(response.status,200);const payload=await response.json() as {summary:{seats:Array<{displayName:string|null}>}};assert.equal(payload.summary.seats[0].displayName,"Guest Host");});

test("Commander verification continues to reject anonymous network entry",async()=>{setRoomRepository(new MemoryRoomRepository());setAccountRepository(new MemoryAccountRepository());setOperationsSettingsRepository(new MemoryOperationsSettingsRepository());const response=await roomsPost(request({action:"create",game:game(),displayName:"Anonymous",mode:"network"},"203.0.113.83"));assert.equal(response.status,400);assert.match((await response.json() as {error:string}).error,/Commander account/);});

test("0.33.3 exposes radial seats and complete Operations controls",async()=>{const [lobby,admin,accessRoute,roomsRoute]=await Promise.all([readFile(new URL("../app/components/network/RoomLobby.tsx",import.meta.url),"utf8"),readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/admin/settings/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/api/admin/rooms/[code]/route.ts",import.meta.url),"utf8")]);assert.match(lobby,/lobby-seat-core/);assert.match(lobby,/--seat-x/);assert.match(lobby,/Controller for seat/);assert.match(lobby,/Choose faction for seat/);assert.match(admin,/Current games/);assert.match(admin,/Room code and display name/);assert.match(accessRoute,/updatePlaytestAccessSettings/);assert.match(roomsRoute,/pauseTurnDeadline/);assert.match(roomsRoute,/clearTurnDeadline/);});
