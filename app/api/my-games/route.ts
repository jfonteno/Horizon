import { accountTokenFromRequest, createPlaytestReport, getAccountService, getRoomRepository } from "../../../game/server";
import { enforceRateLimit } from "../../../game/server/rate-limit";
import type { StoredRoom } from "../../../game/server/types";

const ROOM_CODE = /^[A-Z2-9]{6}$/;

function participantExport(room: StoredRoom, playerId: number) {
  const player = room.game.players[playerId];
  return {
    format: "horizon-participant-game-data", formatVersion: 1,
    room: {code:room.code,name:room.name?.trim()||room.code,status:room.game.result?"complete":room.status,createdAt:room.createdAt,updatedAt:room.updatedAt},
    setup: {mapId:room.game.mapId,format:room.game.format,seed:room.game.seed,factions:room.game.players.map(({id,name,faction})=>({id,name,faction}))},
    outcome: {turn:room.game.turn,era:room.game.era,result:room.game.result||null,standings:room.game.players.map(({id,name,faction,lp,tributes})=>({id,name,faction,lp,tributes}))},
    history: room.game.history,
    gateLedger: room.game.gateLedger,
    ownCivilization: {playerId,faction:player?.faction,legacy:player?.legacy,hiddenLegacy:player?.hiddenLegacy,civilizationClaims:player?.civilizationClaims},
  };
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request,"account",30);
    const token = accountTokenFromRequest(request);
    if (!token) return Response.json({error:"Sign in to manage My Games."},{status:401});
    const account = await getAccountService().authenticate(token);
    const body = await request.json() as {action?:unknown;codes?:unknown};
    if ((body.action!=="download" && body.action!=="delete") || !Array.isArray(body.codes) || !body.codes.length || body.codes.length>200 || body.codes.some(code=>typeof code!=="string"||!ROOM_CODE.test(code)))
      return Response.json({error:"Select 1 to 200 valid games."},{status:400});
    const codes = [...new Set(body.codes as string[])];
    const repository = getRoomRepository();
    const rooms = await Promise.all(codes.map(code=>repository.get(code)));
    if (rooms.some(room=>!room || (room.hostAccountId!==account.id && !room.seats.some(seat=>seat.accountId===account.id && seat.controller.kind==="human"))))
      return Response.json({error:"One or more games are unavailable to this Commander."},{status:403});
    const accessible = rooms as StoredRoom[];
    if (body.action==="download") {
      const games = await Promise.all(accessible.map(async room=>room.hostAccountId===account.id
        ? await createPlaytestReport(room)
        : participantExport(room,room.seats.find(seat=>seat.accountId===account.id)!.playerId)));
      const filename = codes.length===1?`horizon-game-${codes[0]}.json`:`horizon-games-${new Date().toISOString().slice(0,10)}.json`;
      return new Response(`${JSON.stringify({format:"horizon-my-games-export",formatVersion:1,generatedAt:new Date().toISOString(),games},null,2)}\n`,
        {headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="${filename}"`,"cache-control":"no-store"}});
    }
    const hidden = accessible.filter(room=>room.hostAccountId!==account.id).map(room=>room.code);
    if (hidden.length) await getAccountService().hideRooms(token,hidden);
    const deleted:string[]=[];
    const conflicts:string[]=[];
    for (const room of accessible.filter(room=>room.hostAccountId===account.id)) {
      if (await repository.delete(room.code,room.revision)) deleted.push(room.code);
      else conflicts.push(room.code);
    }
    return Response.json({deleted,hidden,conflicts},{headers:{"cache-control":"no-store"}});
  } catch (error) {
    const message = error instanceof Error?error.message:"My Games request failed.";
    return Response.json({error:message},{status:message.startsWith("Too many")?429:message.includes("session")?401:400,headers:{"cache-control":"no-store"}});
  }
}
