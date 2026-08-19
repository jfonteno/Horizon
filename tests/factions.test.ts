import assert from "node:assert/strict";
import test from "node:test";
import {
  brokerTrade,
  buildCivilian,
  createGame,
  economicSalvage,
  evaluateLegacy,
  longRangeSurvey,
  prospect,
  surveyExchange,
} from "../game/index";

test("Foundry constructs a Prospector and prospects an eligible hex once",()=>{
  const game=createGame(2,["foundry","helix"],"shattered-reach","horizon-base",7001),p=game.players[0],home=game.hexes.find(h=>h.owner===0)!;
  p.tech.Exploration=2;p.resources={material:10,currency:10,research:0,influence:1};p.labor=5;
  assert.equal(buildCivilian(game,0,home.id,"prospector").ok,true);
  const unit=game.civilianUnits[0],target=game.hexes.find(h=>!h.revealed&&h.kind==="material")!;target.revealed=true;unit.hex=target.id;unit.readyTurn=1;unit.movesRemaining=0;
  assert.equal(prospect(game,0,unit.id).ok,false);unit.movesRemaining=1;
  assert.equal(prospect(game,0,unit.id).ok,true);assert.equal(target.prospected,true);assert.equal(p.legacyMetrics.prospectedHexes.length,1);assert.equal(prospect(game,0,unit.id).ok,false);
});

test("Farbound surveys remain private and can be sold without public reveal",()=>{
  const game=createGame(2,["farbound","helix"],"shattered-reach","horizon-base",7002),p=game.players[0],target=game.hexes.find(h=>!h.revealed&&h.kind!=="rift")!;
  game.civilianUnits.push({id:"s",owner:0,type:"surveyor",hex:p.explorer,readyTurn:1,movesRemaining:1});
  assert.equal(longRangeSurvey(game,0,"s",target.id).ok,true);game.players[1].resources.currency=5;
  assert.equal(target.revealed,false);assert.equal(surveyExchange(game,0,1,target.id,2).ok,false);p.tech.Policy=2;assert.equal(surveyExchange(game,0,1,target.id,2).ok,true);assert.equal(game.players[1].resources.currency,3);assert.equal(target.revealed,false);
});

test("Meridian Brokerage exchanges resources and pays once per pair each Turn",()=>{
  const game=createGame(3,["meridian","foundry","helix"],"shattered-reach","horizon-base",7003);game.players[1].resources.material=3;game.players[2].resources.currency=4;
  const a={material:2,currency:0,research:0,labor:0},b={material:0,currency:3,research:0,labor:0};
  assert.equal(brokerTrade(game,0,1,2,a,b).ok,true);assert.equal(game.players[0].resources.currency,3);assert.equal(game.players[1].resources.currency,3);assert.equal(game.players[2].resources.material,2);assert.equal(brokerTrade(game,0,1,2,a,b).ok,false);
});

test("Meridian Economic Salvage is atomic and converts exactly 4 stationed CU",()=>{
  const game=createGame(2,["meridian","helix"],"shattered-reach","horizon-base",7004),p=game.players[0],home=game.hexes.find(h=>h.owner===0)!;p.tech.Economy=3;home.combat=3;assert.equal(economicSalvage(game,0).ok,false);assert.equal(home.combat,3);home.combat=5;assert.equal(economicSalvage(game,0).ok,true);assert.equal(home.combat,1);
});

test("completed faction systems award Civilization Legacy automatically",()=>{
  const game=createGame(2,["farbound","helix"],"shattered-reach","horizon-base",7005),p=game.players[0];for(const h of game.hexes.filter(h=>!h.revealed&&h.kind!=="rift").slice(0,6)){p.privateSurveys.push({hexId:h.id,kind:h.kind,surveyedTurn:1,soldTo:[]});h.surveyedBy=[0]}evaluateLegacy(game);assert.ok(p.civilizationClaims.includes("b-survey"));assert.equal(p.legacy.civilization,3);
});

test("Aurelian Foreign Service requires two Envoys hosted simultaneously",()=>{
  const game=createGame(3,["aurelians","helix","foundry"],"shattered-reach","horizon-base",7006),p=game.players[0],hosts=game.hexes.filter(h=>h.owner===1||h.owner===2);
  game.civilianUnits.push({id:"e1",owner:0,type:"envoy",hex:hosts.find(h=>h.owner===1)!.id,readyTurn:1,movesRemaining:0},{id:"e2",owner:0,type:"envoy",hex:hosts.find(h=>h.owner===2)!.id,readyTurn:1,movesRemaining:0});
  evaluateLegacy(game);assert.ok(p.civilizationClaims.includes("a-service"));
});
