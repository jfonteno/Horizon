import assert from "node:assert/strict";
import test from "node:test";
import { createGame, drawHiddenChoices, evaluateLegacy, finalizeGame, hiddenLegacyDeck, legacyObjectiveProgress, scoreHiddenEra, selectHiddenLegacy } from "../game/index";

function legacyGame(){return createGame(2,["varkesh","helix"],"shattered-reach","horizon-base",6060)}

test("a Universal Legacy objective awards its first unique claimant once",()=>{
  const game=legacyGame();
  game.players[0].legacyMetrics.habitatsEstablished[0]=3;
  evaluateLegacy(game);
  assert.equal(game.players[0].lp,3);
  assert.equal(game.players[0].legacy.universal,3);
  assert.equal(game.universalClaims[0].objectiveId,"beyond-frontier");
  evaluateLegacy(game);
  assert.equal(game.players[0].lp,3);
});

test("simultaneous Universal qualification remains unclaimed",()=>{
  const game=legacyGame();
  game.players.forEach(player=>player.legacyMetrics.habitatsEstablished[0]=3);
  evaluateLegacy(game);
  assert.equal(game.universalClaims.length,0);
});

test("automatic Hidden Legacy scores only at Era scoring",()=>{
  const game=legacyGame();
  drawHiddenChoices(game,0,1);
  const state=game.players[0].hiddenLegacy[1];
  const automatic=state.choices.map(id=>hiddenLegacyDeck.find(card=>card.id===id)!).find(card=>card.automatic)!;
  assert.equal(selectHiddenLegacy(game,0,automatic.id),true);
  if(automatic.id==="h1-first") game.hexes.filter(hex=>hex.owner===0)[0].tier="Metropolis";
  else if(automatic.id==="h1-specialist") game.players[0].legacyMetrics.technologyAdvances[0]=["Military","Military"];
  else if(automatic.id==="h1-renaissance") game.players[0].legacyMetrics.technologyAdvances[0]=["Military","Economy"];
  else if(automatic.id==="h1-mobilization"){game.players[0].legacyMetrics.builtVessels[0]=1;game.players[0].legacyMetrics.recruitedCU[0]=2;game.players[0].legacyMetrics.builtCenters[0]=1}
  else if(automatic.id==="h1-peace"){game.players[0].legacyMetrics.habitatsEstablished[0]=1;game.players[0].legacyMetrics.technologyAdvances[0]=["Military"]}
  else if(automatic.id==="h1-pioneer"){game.players[0].eraTributes[0]=1;game.players[0].legacyMetrics.habitatsEstablished[0]=1}
  else if(automatic.id==="h1-surveyor")game.players[0].legacyMetrics.revealedHexes[0]=4;
  else if(automatic.id==="h1-frontier")game.players[0].legacyMetrics.habitatsEstablished[0]=2;
  else if(automatic.id==="h1-merchant")game.players[0].legacyMetrics.tradePartners[0]=[1,2,3];
  else if(automatic.id==="h1-investment")game.players[0].legacyMetrics.receivedTradeValue[0]=5;
  scoreHiddenEra(game,1);
  assert.equal(state.scored,true);
  assert.equal(state.completed,true);
  assert.equal(game.players[0].legacy.hidden,automatic.lp);
});

test("Gate failure causes collective defeat before LP comparison",()=>{
  const game=legacyGame();
  game.turn=16;game.era=4;game.players[0].lp=99;
  const result=finalizeGame(game);
  assert.equal(result.gateSucceeded,false);
  assert.deepEqual(result.winnerIds,[]);
});

test("successful Gate uses LP then locked tiebreakers",()=>{
  const game=legacyGame();
  game.turn=16;game.era=4;game.gate=6;
  game.players[0].lp=10;game.players[1].lp=10;
  game.players[0].tributes=4;game.players[1].tributes=2;
  const result=finalizeGame(game);
  assert.equal(result.gateSucceeded,true);
  assert.deepEqual(result.winnerIds,[0]);
});

test("Legacy progress reports numeric and compound objective progress",()=>{
  const game=legacyGame(),player=game.players[0];
  player.legacyMetrics.habitatsEstablished[0]=2;
  assert.deepEqual(legacyObjectiveProgress(game,0,"beyond-frontier"),{
    current:2,target:3,label:"2 / 3",complete:false,
  });
  player.eraTributes=[1,1,0,0];
  const gateProgress=legacyObjectiveProgress(game,0,"architect-horizon");
  assert.equal(gateProgress.current,2);
  assert.equal(gateProgress.target,4);
  assert.match(gateProgress.label,/2 \/ 4 Eras/);
});
