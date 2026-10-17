import assert from "node:assert/strict";
import test from "node:test";
import { createGame, MemoryRoomRepository, RoomService } from "../game/index";
import { AccountService, MemoryAccountRepository } from "../game/server/accounts";
import { resetRoomRuntimeForTests, setAccountRepository, setRoomRepository } from "../game/server/runtime";
import { POST as manageGames } from "../app/api/my-games/route";
import { POST as accountRoute } from "../app/api/account/route";

const json=async(response:Response)=>await response.json() as {rooms:Array<{code:string;status:string}>;hiddenRoomCodes:string[];games:Array<{format:string}>;hidden:string[];deleted:string[]};

test("My Games separates completed rooms and lets a participant download then remove only their own listing", async () => {
  const rooms = new MemoryRoomRepository(), accounts = new MemoryAccountRepository();
  setRoomRepository(rooms);setAccountRepository(accounts);
  try {
    const service = new AccountService(accounts);
    const host = await service.create("Host"), guest = await service.create("Guest");
    const game = createGame(4,["varkesh","helix","foundry","aurelians"],"standard-board","horizon-base",33017,[{kind:"human"},{kind:"human"},{kind:"bot",profileId:"strategic-director"},{kind:"bot",profileId:"strategic-director"}]);
    const lobby = new RoomService(rooms);
    const session = await lobby.create(game,"Host","network",host.account.id);
    await lobby.join(session.code,1,"Guest",guest.account.id);
    const room = (await rooms.get(session.code))!;
    room.game.result = {gateSucceeded:true,winnerIds:[0],reason:"Test complete",finalizedTurn:16};
    // A legacy room can have a finalized game but a stale status.
    await rooms.put(room);
    const request=(token:string,action:string,codes:string[])=>new Request("http://localhost/api/my-games",{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({action,codes})});
    const accountRequest=(token:string)=>new Request("http://localhost/api/account",{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({action:"resume"})});
    const listing=await accountRoute(accountRequest(guest.token));
    const listingBody=await json(listing);
    assert.equal(listingBody.rooms[0].status,"complete");
    const downloaded=await manageGames(request(guest.token,"download",[session.code]));
    assert.equal(downloaded.status,200);
    const data=await json(downloaded);
    assert.equal(data.games[0].format,"horizon-participant-game-data");
    assert.equal(JSON.stringify(data).includes("hostTokenHash"),false);
    assert.equal(JSON.stringify(data).includes("feedback"),false);
    assert.equal(JSON.stringify(data).includes("botMemory"),false);
    const removed=await manageGames(request(guest.token,"delete",[session.code]));
    assert.equal(removed.status,200);
    assert.deepEqual((await json(removed)).hidden,[session.code]);
    assert.ok(await rooms.get(session.code));
    const later=await json(await accountRoute(accountRequest(guest.token)));
    assert.deepEqual(later.rooms,[]);
    assert.deepEqual(later.hiddenRoomCodes,[session.code]);
    const hostListing=await json(await accountRoute(accountRequest(host.token)));
    assert.equal(hostListing.rooms[0].code,session.code);
    const deleted=await manageGames(request(host.token,"delete",[session.code]));
    assert.deepEqual((await json(deleted)).deleted,[session.code]);
    assert.equal(await rooms.get(session.code),null);
  } finally {resetRoomRuntimeForTests();}
});

test("My Games rejects unauthorized and mixed bulk requests without changing any room", async () => {
  const rooms=new MemoryRoomRepository(), accounts=new MemoryAccountRepository();
  setRoomRepository(rooms);setAccountRepository(accounts);
  try {
    const service=new AccountService(accounts), host=await service.create("Host"), stranger=await service.create("Stranger");
    const game=createGame(4,["varkesh","helix","foundry","aurelians"],"standard-board","horizon-base",33018,[{kind:"human"},{kind:"human"},{kind:"bot",profileId:"strategic-director"},{kind:"bot",profileId:"strategic-director"}]);
    const session=await new RoomService(rooms).create(game,"Host","network",host.account.id);
    const req=(token:string,codes:string[])=>new Request("http://localhost/api/my-games",{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({action:"delete",codes})});
    assert.equal((await manageGames(req(stranger.token,[session.code]))).status,403);
    assert.equal((await manageGames(req(host.token,[session.code,"ABC234"]))).status,403);
    assert.ok(await rooms.get(session.code));
  } finally {resetRoomRuntimeForTests();}
});
