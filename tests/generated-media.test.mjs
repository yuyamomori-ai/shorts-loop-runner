import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../lib/core.mjs';
import {visualClaims} from '../lib/visual.mjs';
import {hash} from '../runner/providers.mjs';
import {captionChunks,captionLines,captionEvents} from '../runner/science-cards.mjs';
import {reserveSpend,settleSpend,spendingSummary} from '../runner/budget.mjs';
import {prepareGeneratedArt} from '../runner/generated-art.mjs';
import {buildScenePlan,sceneFeatures} from '../runner/visual-plan.mjs';
import {prepareLicensedMusic,FREE_TRACK,licensedMusicValid} from '../runner/licensed-music.mjs';
import {pauseAutomation,requestPublicAutopilot} from '../lib/automation.mjs';
const video=()=>({id:'art-test',title:'雲はなぜ白い？',contentType:'A',qa:{facts:'passed'},segments:Array.from({length:6},(_,i)=>({text:i?'水滴が光を散らします。':'雲はなぜ白い？',role:i?'body':'hook',sourceIds:['s1'],visualQuery:'bright white clouds',visualType:i===2?'diagram':'mixed',overlay:'雲と光',durationHint:3.3,...(i===2?{diagramSpec:{type:'process',labels:['光','水滴','散乱'],sourceIds:['s1']}}:{})}))});
test('image spending shares the monetary/daily guard and settles measured tokens conservatively',()=>{
 const s=initialState(),at='2026-09-24T00:00:00Z',spec={kind:'image',model:'gpt-image-2',text:'bright cloud',size:'1024x1536',quality:'medium'},env={SHORTSLOOP_MONTHLY_AI_JPY:'50'};
 const r=reserveSpend(s,spec,{at,env});assert.equal(spendingSummary(s,{at,env}).remainingJpy,0);assert.throws(()=>reserveSpend(s,spec,{at,env}),{code:'MONTHLY_AI_BUDGET'});
 settleSpend(s,r,{usage:{input_tokens:1000,input_tokens_details:{text_tokens:1000},output_tokens:3000}});assert.equal(s.spendGuard.months['2026-09'].requests[0].bookedUsd,.0475);
 assert.throws(()=>reserveSpend(s,{...spec,quality:'high'},{at,env}),{code:'BUDGET_INPUT'});assert.throws(()=>reserveSpend(s,{...spec,model:'unpriced'},{at,env}),{code:'BUDGET_PRICING_UNKNOWN'});
});
test('generated images are sourced to verified narration and cached across visual repairs',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'loop-art-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));let calls=0;
 const v=video(),ai={image:async(prompt,file)=>{calls++;writeFileSync(file,'fixture-'+calls);assert(prompt.includes('NOT a dark'));return {model:'fixture',size:'1024x1536',quality:'medium'};}};
 await assert.rejects(prepareGeneratedArt(v,{directory,ai}),/事実確認/);assert.equal(calls,0);
 v.verifiedContentHash=hash(JSON.stringify(visualClaims(v)));const art=await prepareGeneratedArt(v,{directory,ai});assert.equal(calls,2);await prepareGeneratedArt(v,{directory,ai});assert.equal(calls,2);
 const segments=v.segments.map((s,i)=>({...s,start:i*4,end:(i+1)*4})),scenes=buildScenePlan(v,segments,[],{generatedImages:art});assert.equal(scenes[0].visualType,'generated_image');assert.equal(scenes[0].diagramSpec,undefined);assert(scenes.some(s=>s.diagramSpec));assert(scenes.some(s=>s.imageId==='generated-1'));assert.equal(sceneFeatures(scenes,24).realFootageRatio,0);assert(scenes.some(s=>!s.imageId&&!s.assetId));assert(scenes.filter(s=>s.imageId).length<scenes.length*.7);
 writeFileSync(art[0].file,'changed');await prepareGeneratedArt(v,{directory,ai});assert.equal(calls,3);
});
test('free music metadata is pinned; changed media never reaches an upload',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'loop-free-music-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));let calls=0;
 const fetchAudio=async()=>{calls++;return new Response('invalid MP3');};await assert.rejects(prepareLicensedMusic(directory,{fetchAudio}),/整合性/);assert.equal(calls,1);
 assert(licensedMusicValid({...FREE_TRACK,mode:'licensed',acquiredAt:'2026-09-24'}));assert(!licensedMusicValid({...FREE_TRACK,mode:'licensed',acquiredAt:'2026-09-24',credit:''}));
 mkdirSync(join(directory,'licensed-music'),{recursive:true});writeFileSync(join(directory,'licensed-music',FREE_TRACK.id+'.mp3'),'tampered');await assert.rejects(prepareLicensedMusic(directory,{fetchAudio}),/整合性/);assert.equal(calls,1);
});
test('malformed scripts skip only the rejected video; rights stops still require attention',()=>{
 const s=initialState();requestPublicAutopilot(s,'new-request');pauseAutomation(s,'台本の形式が不正です。');assert.equal(s.settings.paused,false);
 s.automation.reason='台本の形式が不正です。';s.automation.phase='attention';requestPublicAutopilot(s,'new-request-2');assert.equal(s.automation.phase,'waiting');
 pauseAutomation(s,'著作権確認に失敗');requestPublicAutopilot(s,'new-request-3');assert.equal(s.automation.phase,'attention');assert.equal(s.settings.paused,true);
});


test('caption timing follows phrase length and keeps a short question separate from its answer',()=>{
 const text='え、温かいと泡増えるの？そう、温度で溶けにくくなるからです。',cards=captionChunks(text);
 assert.equal(cards[0],'え、温かいと泡増えるの？');assert(!captionLines(cards[1]).includes('に\\Nく'));
 const captions=captionEvents([{text,start:0,end:9}]);
 assert.equal(captions.timeline[0].start,0);assert.equal(captions.timeline.at(-1).end,9);
 assert(captions.timeline[0].end<4.5);assert.equal(captions.timeline[0].end,captions.timeline[1].start);
});
